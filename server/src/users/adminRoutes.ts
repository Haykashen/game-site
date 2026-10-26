import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import {
  adminUserStatusSchema,
  adminUsersQuerySchema,
  paginated,
  type AdminUserDto,
} from '@discvault/shared';
import { requireRoles } from '../auth/authorization.js';
import { badRequest, forbidden, notFound } from '../errors.js';
import { ratingFrom } from '../lib/rating.js';
import { getUserProfile } from '../lib/serializers.js';
import { parse } from '../lib/validation.js';

const adminUserSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  isDemo: true,
  role: true,
  status: true,
  suspendedAt: true,
  suspensionReason: true,
  createdAt: true,
  ratingSum: true,
  ratingCount: true,
  _count: {
    select: {
      copies: true,
    },
  },
} satisfies Prisma.UserSelect;

type AdminUserRow = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

function serializeAdminUser(
  user: AdminUserRow,
  listings: number,
  deals: number,
): AdminUserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    isDemo: user.isDemo,
    role: user.role,
    status: user.status,
    rating: ratingFrom(user.ratingSum, user.ratingCount),
    reviewCount: user.ratingCount,
    listings,
    deals,
    copies: user._count.copies,
    createdAt: user.createdAt.toISOString(),
    suspendedAt: user.suspendedAt?.toISOString() ?? null,
    suspensionReason: user.suspensionReason,
  };
}

/** Administrator-only user directory and account status controls. */
export function registerUserAdminRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/admin/users',
    { preHandler: app.authenticate },
    async (request, reply) => {
      requireRoles(request, ['admin']);

      const query = parse(adminUsersQuerySchema, request.query);
      const search = query.search?.trim();
      const where: Prisma.UserWhereInput = {
        ...(query.role !== 'all' ? { role: query.role } : {}),
        ...(query.status !== 'all' ? { status: query.status } : {}),
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' } },
                { displayName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [total, users] = await app.prisma.$transaction([
        app.prisma.user.count({ where }),
        app.prisma.user.findMany({
          where,
          select: adminUserSelect,
          orderBy: [{ createdAt: 'desc' }, { displayName: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);

      const userIds = users.map((user) => user.id);
      const [listingGroups, buyerGroups, sellerGroups] = await Promise.all([
        userIds.length
          ? app.prisma.marketEntry.groupBy({
              by: ['authorId'],
              where: {
                authorId: { in: userIds },
                deletedAt: null,
              },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        userIds.length
          ? app.prisma.deal.groupBy({
              by: ['buyerId'],
              where: {
                buyerId: { in: userIds },
                status: 'completed',
              },
              _count: { _all: true },
            })
          : Promise.resolve([]),
        userIds.length
          ? app.prisma.deal.groupBy({
              by: ['sellerId'],
              where: {
                sellerId: { in: userIds },
                status: 'completed',
              },
              _count: { _all: true },
            })
          : Promise.resolve([]),
      ]);

      const listingsByUser = new Map(
        listingGroups.map((group) => [group.authorId, group._count._all]),
      );
      const dealsByUser = new Map<string, number>();

      for (const group of buyerGroups) {
        dealsByUser.set(
          group.buyerId,
          (dealsByUser.get(group.buyerId) ?? 0) + group._count._all,
        );
      }

      for (const group of sellerGroups) {
        dealsByUser.set(
          group.sellerId,
          (dealsByUser.get(group.sellerId) ?? 0) + group._count._all,
        );
      }

      return reply.send(
        paginated(
          users.map((user) =>
            serializeAdminUser(
              user,
              listingsByUser.get(user.id) ?? 0,
              dealsByUser.get(user.id) ?? 0,
            ),
          ),
          total,
          query.page,
          query.pageSize,
        ),
      );
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
