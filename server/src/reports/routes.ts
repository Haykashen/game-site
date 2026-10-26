import type { Prisma } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  adminReportsQuerySchema,
  adminUserStatusSchema,
  myReportsQuerySchema,
  paginated,
  reportCreateSchema,
  reportUpdateSchema,
  type ReportUpdateInput,
} from '@discvault/shared';
import { requireRoles } from '../auth/authorization.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../errors.js';
import { isPrismaError } from '../lib/prismaErrors.js';
import { parse } from '../lib/validation.js';
import {
  getUserProfile,
  reportInclude,
  serializeReport,
} from '../lib/serializers.js';

const REPORT_RATE_LIMIT = {
  max: 10,
  timeWindow: '1 day',
} as const;

function activeReportKey(
  reporterId: string,
  targetType: 'market_entry' | 'user',
  targetId: string,
): string {
  return `${reporterId}:${targetType}:${targetId}`;
}

async function createReportForUser(
  app: FastifyInstance,
  request: FastifyRequest,
) {
  const user = request.user;
  if (!user) throw unauthorized();

  const input = parse(reportCreateSchema, request.body);

  let marketEntryId: string | null = null;
  let targetUserId: string | null = null;
  let targetId = input.targetId;

  if (input.targetType === 'market_entry') {
    const entry = await app.prisma.marketEntry.findFirst({
      where: { id: input.targetId, deletedAt: null },
      select: {
        id: true,
        authorId: true,
        moderationStatus: true,
      },
    });

    if (!entry || entry.moderationStatus === 'removed') {
      throw notFound('Объявление не найдено.');
    }

    if (entry.authorId === user.id) {
      throw badRequest('Нельзя пожаловаться на собственное объявление.');
    }

    marketEntryId = entry.id;
    targetId = entry.id;
  } else {
    const target = await app.prisma.user.findUnique({
      where: { id: input.targetId },
      select: { id: true, status: true },
    });

    if (!target || target.status === 'deleted') {
      throw notFound('Пользователь не найден.');
    }

    if (target.id === user.id) {
      throw badRequest('Нельзя пожаловаться на самого себя.');
    }

    targetUserId = target.id;
    targetId = target.id;
  }

  try {
    const report = await app.prisma.report.create({
      data: {
        reporterId: user.id,
        targetType: input.targetType,
        targetId,
        marketEntryId,
        targetUserId,
        reason: input.reason,
        comment: input.comment,
        activeKey: activeReportKey(user.id, input.targetType, targetId),
      },
      include: reportInclude,
    });

    return serializeReport(report);
  } catch (error) {
    if (isPrismaError(error, 'P2002')) {
      throw conflict(
        'REPORT_EXISTS',
        'Вы уже отправили жалобу на эту запись. Она ещё рассматривается.',
      );
    }
    throw error;
  }
}

async function applyReportAction(
  app: FastifyInstance,
  request: FastifyRequest,
  reportId: string,
  input: ReportUpdateInput,
): Promise<unknown> {
  const moderator = requireRoles(request);
  const report = await app.prisma.report.findUnique({
    where: { id: reportId },
    include: reportInclude,
  });

  if (!report) throw notFound('Жалоба не найдена.');

  if (input.action === 'hide_entry') {
    if (!report.marketEntryId) {
      throw badRequest('Эта жалоба не связана с объявлением.');
    }
  }

  let suspendedUserId: string | null = null;

  if (input.action === 'suspend_user') {
    if (moderator.role !== 'admin') {
      throw forbidden('Блокировать пользователей может только администратор.');
    }

    suspendedUserId =
      report.targetUserId ?? report.marketEntry?.authorId ?? null;

    if (!suspendedUserId) {
      throw badRequest('Не удалось определить пользователя для блокировки.');
    }

    if (suspendedUserId === moderator.id) {
      throw badRequest('Нельзя заблокировать собственный аккаунт.');
    }
  }

  return app.prisma.$transaction(async (tx) => {
    if (input.action === 'hide_entry' && report.marketEntryId) {
      await tx.marketEntry.update({
        where: { id: report.marketEntryId },
        data: {
          moderationStatus: 'hidden',
          moderationNote: input.moderatorNote ?? null,
          moderatedAt: new Date(),
          moderatorId: moderator.id,
        },
      });
    }

    if (suspendedUserId) {
      const target = await tx.user.findUnique({
        where: { id: suspendedUserId },
        select: { role: true },
      });

      if (!target) throw notFound('Пользователь не найден.');
      if (target.role === 'admin') {
        throw forbidden('Нельзя заблокировать администратора.');
      }

      await tx.user.update({
        where: { id: suspendedUserId },
        data: {
          status: 'suspended',
          suspendedAt: new Date(),
          suspensionReason: input.moderatorNote ?? null,
        },
      });
      await tx.session.deleteMany({ where: { userId: suspendedUserId } });
    }

    const updated = await tx.report.update({
      where: { id: reportId },
      data: {
        status: input.status,
        action: input.action,
        moderatorId: moderator.id,
        ...(input.moderatorNote !== undefined
          ? { moderatorNote: input.moderatorNote }
          : {}),
        ...(input.status === 'resolved' || input.status === 'dismissed'
          ? { activeKey: null, resolvedAt: new Date() }
          : {}),
      },
      include: reportInclude,
    });

    return serializeReport(updated);
  });
}

export function registerReportRoutes(app: FastifyInstance): void {
  app.post(
    '/api/v1/reports',
    {
      preHandler: app.authenticate,
      config: { rateLimit: REPORT_RATE_LIMIT },
    },
    async (request, reply) => {
      const report = await createReportForUser(app, request);
      return reply.code(201).send(report);
    },
  );

  app.get(
    '/api/v1/reports/mine',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const query = parse(myReportsQuerySchema, request.query);
      const where: Prisma.ReportWhereInput = {
        reporterId: user.id,
        ...(query.status !== 'all' ? { status: query.status } : {}),
      };

      const [total, reports] = await app.prisma.$transaction([
        app.prisma.report.count({ where }),
        app.prisma.report.findMany({
          where,
          include: reportInclude,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);

      return reply.send(
        paginated(
          reports.map(serializeReport),
          total,
          query.page,
          query.pageSize,
        ),
      );
    },
  );

  app.get(
    '/api/v1/admin/reports',
    { preHandler: app.authenticate },
    async (request, reply) => {
      requireRoles(request);

      const query = parse(adminReportsQuerySchema, request.query);
      const where: Prisma.ReportWhereInput = {
        ...(query.status !== 'all' ? { status: query.status } : {}),
        ...(query.targetType ? { targetType: query.targetType } : {}),
        ...(query.reason ? { reason: query.reason } : {}),
      };

      const [total, reports] = await app.prisma.$transaction([
        app.prisma.report.count({ where }),
        app.prisma.report.findMany({
          where,
          include: reportInclude,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);

      return reply.send(
        paginated(
          reports.map(serializeReport),
          total,
          query.page,
          query.pageSize,
        ),
      );
    },
  );

  app.patch(
    '/api/v1/admin/reports/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const input = parse(reportUpdateSchema, request.body);
      const report = await applyReportAction(app, request, id, input);
      return reply.send(report);
    },
  );

  app.patch(
    '/api/v1/admin/users/:id/status',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const admin = requireRoles(request, ['admin']);
      const { id } = request.params as { id: string };
      const input = parse(adminUserStatusSchema, request.body);

      if (id === admin.id && input.status === 'suspended') {
        throw badRequest('Нельзя заблокировать собственный аккаунт.');
      }

      const target = await app.prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
      });

      if (!target) throw notFound('Пользователь не найден.');

      if (target.role === 'admin' && input.status === 'suspended') {
        throw forbidden('Нельзя заблокировать администратора.');
      }

      const user = await app.prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id },
          data: {
            status: input.status,
            suspendedAt: input.status === 'suspended' ? new Date() : null,
            suspensionReason:
              input.status === 'suspended' ? (input.reason ?? null) : null,
          },
        });

        if (input.status === 'suspended') {
          await tx.session.deleteMany({ where: { userId: id } });
        }

        return updated;
      });

      return reply.send({ user: await getUserProfile(app.prisma, user) });
    },
  );
}
