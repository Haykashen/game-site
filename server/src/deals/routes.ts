import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import {
  dealsQuerySchema,
  paginated,
  reviewCreateSchema,
  type DealDto,
} from '@retrokeep/shared';
import { dealInclude, reviewInclude, serializeDeal, serializeReview } from '../lib/serializers.js';
import { conflict, forbidden, notFound, unauthorized } from '../errors.js';
import { parse } from '../lib/validation.js';
import { isPrismaError } from '../lib/prismaErrors.js';
import { dealStatusUpdateSchema } from '@retrokeep/shared';

async function getDealForUser(app: FastifyInstance, id: string, userId: string) {
  const deal = await app.prisma.deal.findUnique({
    where: { id },
    include: dealInclude,
  });

  if (!deal) throw notFound('Сделка не найдена.');

  if (deal.buyerId !== userId && deal.sellerId !== userId) {
    throw forbidden('Эта сделка относится к другим пользователям.');
  }

  return deal;
}

export function registerDealRoutes(app: FastifyInstance): void {
  app.post(
    '/api/v1/market/:id/deals',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const { id } = request.params as { id: string };

      const entry = await app.prisma.marketEntry.findFirst({
        where: { id, deletedAt: null },
        select: {
          id: true,
          authorId: true,
          kind: true,
          listingType: true,
          status: true,
          priceMinor: true,
          deal: { select: { id: true } },
        },
      });

      if (!entry) throw notFound('Объявление не найдено.');

      if (entry.kind !== 'listing') {
        throw conflict(
          'AUCTION_DEAL_AUTOMATIC',
          'Сделка по аукциону создаётся автоматически после завершения торгов.',
        );
      }

      if (entry.authorId === user.id) {
        throw forbidden('Нельзя заключить сделку с самим собой.');
      }

      if (entry.status !== 'active' || entry.deal) {
        throw conflict('ENTRY_NOT_AVAILABLE', 'Лот уже недоступен для сделки.');
      }

      const isPurchase = entry.listingType === 'purchase';
      const buyerId = isPurchase ? entry.authorId : user.id;
      const sellerId = isPurchase ? user.id : entry.authorId;

      try {
        const deal = await app.prisma.$transaction(async (tx) => {
          const updated = await tx.marketEntry.updateMany({
            where: {
              id,
              status: 'active',
              deletedAt: null,
              deal: { is: null },
            },
            data: {
              status: 'sold',
              soldAt: new Date(),
              version: { increment: 1 },
            },
          });

          if (updated.count === 0) {
            throw conflict('ENTRY_NOT_AVAILABLE', 'Лот уже недоступен для сделки.');
          }

          return tx.deal.create({
            data: {
              marketEntryId: id,
              buyerId,
              sellerId,
              amountMinor: entry.priceMinor,
              status: 'pending',
            },
            include: dealInclude,
          });
        });

        const body: DealDto = serializeDeal(deal, user.id);
        return reply.code(201).send(body);
      } catch (error) {
        if (isPrismaError(error, 'P2002')) {
          throw conflict('ENTRY_NOT_AVAILABLE', 'Сделка по этому лоту уже создана.');
        }
        throw error;
      }
    },
  );

  app.get(
    '/api/v1/deals',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const query = parse(dealsQuerySchema, request.query);

      const where: Prisma.DealWhereInput = {
        ...(query.role === 'buyer'
          ? { buyerId: user.id }
          : query.role === 'seller'
            ? { sellerId: user.id }
            : { OR: [{ buyerId: user.id }, { sellerId: user.id }] }),
        ...(query.status !== 'all' ? { status: query.status } : {}),
      };

      const [total, deals] = await app.prisma.$transaction([
        app.prisma.deal.count({ where }),
        app.prisma.deal.findMany({
          where,
          include: dealInclude,
          orderBy: { createdAt: 'desc' },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
      ]);

      return reply.send(
        paginated(
          deals.map((deal) => serializeDeal(deal, user.id)),
          total,
          query.page,
          query.pageSize,
        ),
      );
    },
  );

  app.get(
    '/api/v1/deals/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const { id } = request.params as { id: string };
      const deal = await getDealForUser(app, id, user.id);

      return reply.send(serializeDeal(deal, user.id));
    },
  );

  app.patch(
    '/api/v1/deals/:id/status',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const { id } = request.params as { id: string };
      const input = parse(dealStatusUpdateSchema, request.body);

      const existing = await app.prisma.deal.findUnique({
        where: { id },
        select: {
          id: true,
          buyerId: true,
          sellerId: true,
          status: true,
          marketEntryId: true,
          marketEntry: { select: { kind: true, deletedAt: true } },
        },
      });

      if (!existing) throw notFound('Сделка не найдена.');

      if (existing.buyerId !== user.id && existing.sellerId !== user.id) {
        throw forbidden('Эта сделка относится к другим пользователям.');
      }

      if (existing.status !== 'pending') {
        throw conflict('DEAL_ALREADY_CLOSED', 'Сделка уже завершена или отменена.');
      }

      const deal = await app.prisma.$transaction(async (tx) => {
        const changed = await tx.deal.updateMany({
          where: { id, status: 'pending' },
          data: {
            status: input.status,
            completedAt: input.status === 'completed' ? new Date() : null,
          },
        });

        if (changed.count === 0) {
          throw conflict(
            'DEAL_ALREADY_CLOSED',
            'Сделка уже завершена или отменена.',
          );
        }

        const updated = await tx.deal.findUniqueOrThrow({
          where: { id },
          include: dealInclude,
        });

        if (
          input.status === 'cancelled' &&
          existing.marketEntry.kind === 'listing' &&
          existing.marketEntry.deletedAt === null
        ) {
          await tx.marketEntry.update({
            where: { id: existing.marketEntryId },
            data: {
              status: 'active',
              soldAt: null,
              version: { increment: 1 },
            },
          });

          // `marketEntryId` is unique. A cancelled negotiation must not block
          // the listing from being sold again, so remove the pending deal.
          await tx.deal.delete({ where: { id } });
        }

        return updated;
      });

      return reply.send(serializeDeal(deal, user.id));
    },
  );

  app.post(
    '/api/v1/deals/:id/reviews',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const { id } = request.params as { id: string };
      const input = parse(reviewCreateSchema, request.body);

      const deal = await getDealForUser(app, id, user.id);

      if (deal.status !== 'completed') {
        throw conflict('DEAL_NOT_COMPLETED', 'Отзыв можно оставить после завершения сделки.');
      }

      if (deal.reviews.some((review) => review.authorId === user.id)) {
        throw conflict('REVIEW_EXISTS', 'Вы уже оставили отзыв по этой сделке.');
      }

      const targetId = deal.buyerId === user.id ? deal.sellerId : deal.buyerId;

      try {
        const review = await app.prisma.$transaction(async (tx) => {
          const created = await tx.review.create({
            data: {
              dealId: id,
              authorId: user.id,
              targetId,
              rating: input.rating,
              text: input.text,
            },
            include: reviewInclude,
          });

          await tx.user.update({
            where: { id: targetId },
            data: {
              ratingSum: { increment: input.rating },
              ratingCount: { increment: 1 },
            },
          });

          return created;
        });

        return reply.code(201).send(serializeReview(review));
      } catch (error) {
        if (isPrismaError(error, 'P2002')) {
          throw conflict('REVIEW_EXISTS', 'Вы уже оставили отзыв по этой сделке.');
        }
        throw error;
      }
    },
  );
}
