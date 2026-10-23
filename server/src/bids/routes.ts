import type { FastifyInstance } from 'fastify';
import {
  bidCreateSchema,
  fromMinorUnits,
  paginated,
  paginationSchema,
  toMinorUnits,
  type BidDto,
  type PlaceBidResponse,
} from '@retrokeep/shared';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../errors.js';
import {
  bidInclude,
  marketEntryInclude,
  serializeBid,
  serializeMarketEntry,
} from '../lib/serializers.js';
import { parse } from '../lib/validation.js';
import { notifyNewBid } from '../notifications/events.js';
import { closeExpiredAuctions } from '../market/auctionCloser.js';

const MAX_BID_RETRIES = 4;

export function registerBidRoutes(app: FastifyInstance): void {
  app.get('/api/v1/market/:id/bids', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = parse(paginationSchema, request.query);

    await closeExpiredAuctions(app.prisma, id);

    const entry = await app.prisma.marketEntry.findFirst({
      where: {
        id,
        deletedAt: null,
        moderationStatus: 'visible',
        author: { status: 'active' },
      },
      select: { id: true },
    });

    if (!entry) throw notFound('Объявление не найдено.');

    const [total, bids] = await app.prisma.$transaction([
      app.prisma.bid.count({ where: { marketEntryId: id } }),
      app.prisma.bid.findMany({
        where: { marketEntryId: id },
        include: bidInclude,
        orderBy: [{ amountMinor: 'desc' }, { createdAt: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return reply.send(
      paginated(bids.map(serializeBid), total, query.page, query.pageSize),
    );
  });

  app.post(
    '/api/v1/market/:id/bids',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const { id } = request.params as { id: string };
      const { amount } = parse(bidCreateSchema, request.body);
      const amountMinor = toMinorUnits(amount);

      await closeExpiredAuctions(app.prisma, id);

      for (let attempt = 0; attempt < MAX_BID_RETRIES; attempt += 1) {
        const entry = await app.prisma.marketEntry.findFirst({
          where: {
            id,
            deletedAt: null,
            moderationStatus: 'visible',
            author: { status: 'active' },
          },
          select: {
            id: true,
            title: true,
            gameId: true,
            kind: true,
            authorId: true,
            status: true,
            moderationStatus: true,
            startsAt: true,
            endsAt: true,
            priceMinor: true,
            bidStepMinor: true,
            currentPriceMinor: true,
            bidCount: true,
            version: true,
            author: { select: { status: true } },
          },
        });

        if (!entry) throw notFound('Объявление не найдено.');

        if (
          entry.moderationStatus !== 'visible' ||
          entry.author.status !== 'active'
        ) {
          throw notFound('Объявление не найдено.');
        }

        if (entry.kind !== 'auction' || !entry.endsAt) {
          throw badRequest('Ставки принимаются только в аукционах.');
        }

        if (entry.authorId === user.id) {
          throw forbidden('Нельзя делать ставки на свой лот.');
        }

        if (entry.status !== 'active') {
          throw conflict('AUCTION_CLOSED', 'Торги по этому лоту уже завершены.');
        }

        const now = Date.now();

        if (entry.startsAt && entry.startsAt.getTime() > now) {
          throw conflict('AUCTION_NOT_STARTED', 'Торги ещё не открылись.');
        }

        if (entry.endsAt.getTime() <= now) {
          await closeExpiredAuctions(app.prisma, id);
          throw conflict('AUCTION_ENDED', 'Время торгов истекло.');
        }

        const hasBids = entry.bidCount > 0;
        const currentMinor = entry.currentPriceMinor ?? entry.priceMinor;
        const minimumMinor = hasBids
          ? currentMinor + (entry.bidStepMinor ?? 0)
          : entry.priceMinor;

        if (amountMinor < minimumMinor) {
          throw badRequest('Ставка ниже минимальной.', {
            minimum: fromMinorUnits(minimumMinor),
            amount,
          });
        }

        const bid = await app.prisma.$transaction(async (tx) => {
          const previousTopBid = await tx.bid.findFirst({
            where: { marketEntryId: id },
            orderBy: [{ amountMinor: 'desc' }, { createdAt: 'asc' }],
            select: { bidderId: true },
          });

          const updated = await tx.marketEntry.updateMany({
            where: {
              id,
              status: 'active',
              moderationStatus: 'visible',
              version: entry.version,
            },
            data: {
              currentPriceMinor: amountMinor,
              bidCount: { increment: 1 },
              version: { increment: 1 },
            },
          });

          if (updated.count === 0) return null;

          const created = await tx.bid.create({
            data: {
              marketEntryId: id,
              bidderId: user.id,
              amountMinor,
            },
            include: bidInclude,
          });

          await notifyNewBid(tx, {
            entryId: id,
            entryTitle: entry.title,
            gameId: entry.gameId,
            authorId: entry.authorId,
            bidId: created.id,
            bidder: { id: user.id, displayName: user.displayName },
            amountMinor,
            previousBidderId: previousTopBid?.bidderId ?? null,
          });

          return created;
        });

        if (!bid) continue;

        const updatedEntry = await app.prisma.marketEntry.findUniqueOrThrow({
          where: { id },
          include: marketEntryInclude,
        });

        const body: PlaceBidResponse = {
          bid: serializeBid(bid) as BidDto,
          entry: serializeMarketEntry(updatedEntry),
        };

        return reply.code(201).send(body);
      }

      throw conflict(
        'BID_CONFLICT',
        'Ставку не удалось зафиксировать из-за одновременной ставки. Попробуйте ещё раз.',
      );
    },
  );
}
