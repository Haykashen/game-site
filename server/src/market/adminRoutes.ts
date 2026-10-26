import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import {
  adminMarketModerationSchema,
  adminMarketQueueQuerySchema,
  paginated,
} from '@discvault/shared';
import { requireRoles } from '../auth/authorization.js';
import { conflict, notFound } from '../errors.js';
import { isPrismaError } from '../lib/prismaErrors.js';
import {
  adminMarketEntryInclude,
  serializeAdminMarketEntry,
} from '../lib/serializers.js';
import { parse } from '../lib/validation.js';
import {
  notifyEntryModerated,
  notifyNewEntry,
} from '../notifications/events.js';

/**
 * Administration queue for lots that must be reviewed before publication.
 * Public market routes still hide everything except `visible` entries.
 */
export function registerMarketAdminRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/admin/market',
    { preHandler: app.authenticate },
    async (request, reply) => {
      requireRoles(request);

      const query = parse(adminMarketQueueQuerySchema, request.query);
      const where: Prisma.MarketEntryWhereInput = {
        deletedAt: null,
        ...(query.status !== 'all' ? { moderationStatus: query.status } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
      };

      const [total, entries] = await app.prisma.$transaction([
        app.prisma.marketEntry.count({ where }),
        app.prisma.marketEntry.findMany({
          where,
          include: adminMarketEntryInclude,
          orderBy:
            query.status === 'pending'
              ? { createdAt: 'asc' }
              : { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);

      return reply.send(
        paginated(
          entries.map(serializeAdminMarketEntry),
          total,
          query.page,
          query.pageSize,
        ),
      );
    },
  );

  app.patch(
    '/api/v1/admin/market/:id/moderation',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const moderator = requireRoles(request);
      const { id } = request.params as { id: string };
      const input = parse(adminMarketModerationSchema, request.body);

      const existing = await app.prisma.marketEntry.findFirst({
        where: { id, deletedAt: null },
        include: {
          author: { select: { status: true } },
          game: { select: { title: true } },
        },
      });

      if (!existing) throw notFound('Объявление не найдено.');

      if (
        input.moderationStatus === 'visible' &&
        existing.moderationStatus !== 'visible'
      ) {
        if (existing.author.status !== 'active') {
          throw conflict(
            'AUTHOR_SUSPENDED',
            'Автор лота заблокирован. Публикация недоступна.',
          );
        }

        if (
          existing.kind === 'auction' &&
          existing.endsAt &&
          existing.endsAt.getTime() <= Date.now()
        ) {
          throw conflict(
            'AUCTION_EXPIRED',
            'Аукцион уже завершился. Отклоните лот или попросите автора продлить торги.',
          );
        }
      }

      const moderatedAt = new Date();
      const entry = await app.prisma.$transaction(async (tx) => {
        const updated = await tx.marketEntry
          .update({
            where: { id },
            data: {
              moderationStatus: input.moderationStatus,
              moderationNote: input.note ?? null,
              moderatedAt,
              moderatorId: moderator.id,
              version: { increment: 1 },
            },
            include: adminMarketEntryInclude,
          })
          .catch((error: unknown) => {
            if (isPrismaError(error, 'P2025')) return null;
            throw error;
          });

        if (!updated) throw notFound('Объявление не найдено.');

        // Subscribers learn about the lot only when it actually becomes public.
        if (
          existing.moderationStatus === 'pending' &&
          input.moderationStatus === 'visible' &&
          updated.status === 'active'
        ) {
          await notifyNewEntry(tx, {
            id: updated.id,
            title: updated.title,
            kind: updated.kind,
            gameId: updated.gameId,
            authorId: updated.authorId,
            version: updated.version,
            gameTitle: existing.game.title,
          });
        }

        if (
          existing.moderationStatus !== input.moderationStatus &&
          input.moderationStatus !== 'pending'
        ) {
          await notifyEntryModerated(tx, {
            entry: updated,
            status: input.moderationStatus,
            note: input.note ?? null,
          });
        }

        return updated;
      });

      return reply.send(serializeAdminMarketEntry(entry));
    },
  );
}
