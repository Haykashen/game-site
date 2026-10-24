import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  fromMinorUnits,
  marketCreateSchema,
  marketSearchSchema,
  marketStatusUpdateSchema,
  marketUpdateSchema,
  paginated,
  toMinorUnits,
  type MarketCreateInput,
  type MarketEntryDto,
  type MarketSearchQuery,
} from '@discvault/shared';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../errors.js';
import { deliveryServicesFromApi, serializeDeliveryServices } from '../lib/delivery.js';
import { isPrismaError } from '../lib/prismaErrors.js';
import {
  marketEntryInclude,
  serializeMarketEntry,
} from '../lib/serializers.js';
import { storePhotoReferences } from '../lib/storage.js';
import { parse } from '../lib/validation.js';
import {
  notifyEntryPriceChanged,
  notifyEntryStatusChange,
  notifyNewEntry,
} from '../notifications/events.js';
import { closeAuctionById, closeExpiredAuctions } from './auctionCloser.js';
import { buildMarketOrderBy, buildMarketWhere } from './query.js';

async function assertMarketTarget(
  app: FastifyInstance,
  gameId: string,
  editionId: string | null | undefined,
): Promise<{ id: string; title: string }> {
  const game = await app.prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, title: true },
  });

  if (!game) throw notFound('Игра не найдена.');

  if (editionId) {
    const edition = await app.prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, gameId: true },
    });

    if (!edition || edition.gameId !== gameId) {
      throw badRequest('Издание не относится к выбранной игре.');
    }
  }

  return game;
}

function auctionDates(
  input: Pick<MarketCreateInput, 'kind' | 'startsAt' | 'endsAt'>,
): { startsAt: Date | null; endsAt: Date | null } {
  if (input.kind !== 'auction') return { startsAt: null, endsAt: null };

  const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;

  return { startsAt, endsAt };
}

function photoCreateData(urls: readonly string[]) {
  return urls.map((url, index) => ({ url, sortOrder: index }));
}

async function listMarketEntries(
  app: FastifyInstance,
  request: FastifyRequest,
  statusDefault: MarketSearchQuery['status'],
  forcedAuthorId?: string,
) {
  const rawQuery = request.query as Record<string, unknown>;
  const query = parse(marketSearchSchema, {
    ...rawQuery,
    status: rawQuery.status ?? statusDefault,
  });

  const user = request.user;

  if (query.authorId === 'me' && !user) {
    throw unauthorized();
  }

  const authorId =
    forcedAuthorId ?? (query.authorId === 'me' ? user?.id : query.authorId);
  const includeModeration = Boolean(
    forcedAuthorId || (query.authorId === 'me' && user),
  );

  await closeExpiredAuctions(app.prisma);

  const where = buildMarketWhere(query, authorId, includeModeration);
  const skip = (query.page - 1) * query.pageSize;

  const [total, entries] = await app.prisma.$transaction([
    app.prisma.marketEntry.count({ where }),
    app.prisma.marketEntry.findMany({
      where,
      include: marketEntryInclude,
      orderBy: buildMarketOrderBy(query.sort),
      skip,
      take: query.pageSize,
    }),
  ]);

  return paginated(
    entries.map(serializeMarketEntry),
    total,
    query.page,
    query.pageSize,
  );
}

export function registerMarketRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/market',
    { preHandler: app.optionalAuth },
    async (request, reply) => reply.send(await listMarketEntries(app, request, 'active')),
  );

  app.get(
    '/api/v1/market/mine',
    { preHandler: app.authenticate },
    async (request, reply) =>
      reply.send(
        await listMarketEntries(app, request, 'all', request.user?.id),
      ),
  );

  app.get(
    '/api/v1/market/:id',
    { preHandler: app.optionalAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      await closeExpiredAuctions(app.prisma, id);

      const entry = await app.prisma.marketEntry.findFirst({
        where: { id, deletedAt: null },
        include: marketEntryInclude,
      });

      if (!entry) throw notFound('Объявление не найдено.');

      const user = request.user;
      const canSeeModeration = Boolean(
        user &&
          (user.id === entry.authorId ||
            user.role === 'admin' ||
            user.role === 'moderator'),
      );

      if (
        !canSeeModeration &&
        (entry.moderationStatus !== 'visible' || entry.author.status !== 'active')
      ) {
        throw notFound('Объявление не найдено.');
      }

      return reply.send(serializeMarketEntry(entry));
    },
  );

  app.post(
    '/api/v1/market',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const input = parse(marketCreateSchema, request.body);
      const game = await assertMarketTarget(app, input.gameId, input.editionId);

      const photos = await storePhotoReferences(input.photos, 'market');
      const priceMinor = toMinorUnits(input.price);
      const dates = auctionDates(input);

      if (input.kind === 'auction') {
        if (!dates.endsAt) throw badRequest('Укажите дату закрытия аукциона.');
        if (dates.endsAt.getTime() <= Date.now()) {
          throw badRequest('Дата закрытия аукциона должна быть в будущем.');
        }
      }

      const entry = await app.prisma.$transaction(async (tx) => {
        const created = await tx.marketEntry.create({
          data: {
            authorId: user.id,
            kind: input.kind,
            listingType: input.kind === 'auction' ? null : (input.listingType ?? null),
            gameId: input.gameId,
            editionId: input.editionId ?? null,
            title: input.title,
            condition: input.condition,
            priceMinor,
            description: input.description,
            status: 'active',
            deliveryServices: deliveryServicesFromApi(input.deliveryServices),
            internationalShipping: input.internationalShipping ?? null,
            packagingPriceMinor:
              input.packagingPrice === null || input.packagingPrice === undefined
                ? null
                : toMinorUnits(input.packagingPrice),
            shipsFrom: input.shipsFrom,
            bidStepMinor:
              input.kind === 'auction' && input.bidStep
                ? toMinorUnits(input.bidStep)
                : null,
            startsAt: dates.startsAt,
            endsAt: dates.endsAt,
            currentPriceMinor: input.kind === 'auction' ? priceMinor : null,
            ...(photos.length > 0 ? { photos: { create: photoCreateData(photos) } } : {}),
          },
          include: marketEntryInclude,
        });

        await notifyNewEntry(tx, {
          id: created.id,
          title: created.title,
          kind: created.kind,
          gameId: created.gameId,
          authorId: created.authorId,
          version: created.version,
          gameTitle: game.title,
        });

        return created;
      });

      const body: MarketEntryDto = serializeMarketEntry(entry);
      return reply.code(201).send(body);
    },
  );

  app.patch(
    '/api/v1/market/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const { id } = request.params as { id: string };
      const input = parse(marketUpdateSchema, request.body);

      const existing = await app.prisma.marketEntry.findFirst({
        where: { id, deletedAt: null },
        include: { photos: { orderBy: { sortOrder: 'asc' } } },
      });

      if (!existing) throw notFound('Объявление не найдено.');
      if (existing.authorId !== user.id) throw forbidden('Это не ваше объявление.');

      const merged = {
        kind: input.kind ?? existing.kind,
        listingType:
          input.listingType !== undefined ? input.listingType : existing.listingType,
        gameId: input.gameId ?? existing.gameId,
        editionId:
          input.editionId !== undefined ? input.editionId : existing.editionId,
        title: input.title ?? existing.title,
        condition: input.condition ?? existing.condition,
        price: input.price ?? fromMinorUnits(existing.priceMinor),
        description: input.description ?? existing.description,
        photos: input.photos ?? existing.photos.map((photo) => photo.url),
        deliveryServices:
          input.deliveryServices ??
          serializeDeliveryServices(existing.deliveryServices),
        internationalShipping:
          input.internationalShipping !== undefined
            ? input.internationalShipping
            : existing.internationalShipping,
        packagingPrice:
          input.packagingPrice !== undefined
            ? input.packagingPrice
            : existing.packagingPriceMinor === null
              ? null
              : fromMinorUnits(existing.packagingPriceMinor),
        shipsFrom: input.shipsFrom ?? existing.shipsFrom,
        bidStep:
          input.bidStep !== undefined
            ? input.bidStep
            : existing.bidStepMinor === null
              ? null
              : fromMinorUnits(existing.bidStepMinor),
        startsAt:
          input.startsAt !== undefined
            ? input.startsAt
            : (existing.startsAt?.toISOString() ?? null),
        endsAt:
          input.endsAt !== undefined
            ? input.endsAt
            : (existing.endsAt?.toISOString() ?? null),
      };

      const validated = parse(marketCreateSchema, merged);

      if (existing.bidCount > 0) {
        const sameDate = (next: string | null | undefined, current: Date | null) => {
          const nextTime = next ? Date.parse(next) : null;
          const currentTime = current ? current.getTime() : null;
          return nextTime === currentTime;
        };

        const immutableChanged =
          validated.kind !== existing.kind ||
          validated.gameId !== existing.gameId ||
          (validated.editionId ?? null) !== existing.editionId ||
          toMinorUnits(validated.price) !== existing.priceMinor ||
          (validated.bidStep ? toMinorUnits(validated.bidStep) : null) !==
            existing.bidStepMinor ||
          !sameDate(validated.startsAt, existing.startsAt) ||
          !sameDate(validated.endsAt, existing.endsAt);

        if (immutableChanged) {
          throw conflict(
            'AUCTION_HAS_BIDS',
            'После первой ставки нельзя менять игру, издание, цену, шаг и даты аукциона.',
          );
        }
      }

      await assertMarketTarget(app, validated.gameId, validated.editionId);

      const photos =
        input.photos !== undefined
          ? await storePhotoReferences(input.photos, 'market')
          : undefined;

      const dates = auctionDates(validated);
      const priceMinor = toMinorUnits(validated.price);

      if (
        validated.kind === 'auction' &&
        dates.endsAt &&
        dates.endsAt.getTime() <= Date.now()
      ) {
        throw badRequest('Аукцион должен заканчиваться в будущем.');
      }

      try {
        const entry = await app.prisma.$transaction(async (tx) => {
          const updated = await tx.marketEntry.update({
            where: { id, version: existing.version },
            data: {
              version: { increment: 1 },
              kind: validated.kind,
              listingType:
                validated.kind === 'auction' ? null : (validated.listingType ?? null),
              gameId: validated.gameId,
              editionId: validated.editionId ?? null,
              title: validated.title,
              condition: validated.condition,
              priceMinor,
              description: validated.description,
              deliveryServices: deliveryServicesFromApi(validated.deliveryServices),
              internationalShipping: validated.internationalShipping ?? null,
              packagingPriceMinor:
                validated.packagingPrice === null || validated.packagingPrice === undefined
                  ? null
                  : toMinorUnits(validated.packagingPrice),
              shipsFrom: validated.shipsFrom,
              bidStepMinor:
                validated.kind === 'auction' && validated.bidStep
                  ? toMinorUnits(validated.bidStep)
                  : null,
              startsAt: dates.startsAt,
              endsAt: dates.endsAt,
              currentPriceMinor:
                existing.bidCount === 0 && validated.kind === 'auction'
                  ? priceMinor
                  : existing.currentPriceMinor,
              ...(photos !== undefined
                ? {
                    photos: {
                      deleteMany: {},
                      create: photoCreateData(photos),
                    },
                  }
                : {}),
            },
            include: marketEntryInclude,
          });

          await notifyEntryPriceChanged(tx, {
            entry: updated,
            previousPriceMinor: existing.priceMinor,
            priceMinor,
          });

          return updated;
        });

        return reply.send(serializeMarketEntry(entry));
      } catch (error) {
        if (isPrismaError(error, 'P2025')) {
          throw conflict(
            'MARKET_CHANGED',
            'Объявление изменилось. Обновите страницу и попробуйте снова.',
          );
        }
        throw error;
      }
    },
  );

  app.patch(
    '/api/v1/market/:id/status',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const { id } = request.params as { id: string };
      const input = parse(marketStatusUpdateSchema, request.body);

      const existing = await app.prisma.marketEntry.findFirst({
        where: { id, deletedAt: null },
        select: {
          id: true,
          authorId: true,
          title: true,
          gameId: true,
          kind: true,
          status: true,
          endsAt: true,
          version: true,
          deal: { select: { id: true } },
        },
      });

      if (!existing) throw notFound('Объявление не найдено.');
      if (existing.authorId !== user.id) throw forbidden('Это не ваше объявление.');

      if (input.status === 'sold' && existing.kind === 'auction') {
        throw conflict(
          'AUCTION_STATUS_MANAGED',
          'Аукцион закрывается автоматически после окончания торгов.',
        );
      }

      let shouldNotifyStatusChange = true;

      if (input.status === 'active') {
        if (existing.deal) {
          throw conflict('ENTRY_HAS_DEAL', 'По лоту уже создана сделка — вернуть его в продажу нельзя.');
        }

        if (
          existing.kind === 'auction' &&
          existing.endsAt &&
          existing.endsAt.getTime() <= Date.now()
        ) {
          shouldNotifyStatusChange = false;
          await closeAuctionById(app.prisma, id);
        } else {
          const changed = await app.prisma.marketEntry.updateMany({
            where: { id, version: existing.version },
            data: {
              status: 'active',
              soldAt: null,
              winnerId: null,
              version: { increment: 1 },
            },
          });

          if (changed.count === 0) {
            throw conflict(
              'MARKET_CHANGED',
              'Объявление изменилось. Обновите страницу и попробуйте снова.',
            );
          }
        }
      } else {
        const changed = await app.prisma.marketEntry.updateMany({
          where: { id, version: existing.version },
          data: {
            status: input.status,
            version: { increment: 1 },
            ...(input.status === 'sold' ? { soldAt: new Date() } : {}),
          },
        });

        if (changed.count === 0) {
          throw conflict(
            'MARKET_CHANGED',
            'Объявление изменилось. Обновите страницу и попробуйте снова.',
          );
        }
      }

      const entry = await app.prisma.marketEntry.findUniqueOrThrow({
        where: { id },
        include: marketEntryInclude,
      });

      if (shouldNotifyStatusChange) {
        await notifyEntryStatusChange(app.prisma, {
          entry,
          previousStatus: existing.status,
          status: input.status,
        });
      }

      return reply.send(serializeMarketEntry(entry));
    },
  );

  app.delete(
    '/api/v1/market/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const user = request.user;
      if (!user) throw unauthorized();

      const { id } = request.params as { id: string };

      const existing = await app.prisma.marketEntry.findFirst({
        where: { id, deletedAt: null },
        select: {
          id: true,
          authorId: true,
          bidCount: true,
          deal: { select: { id: true } },
          _count: { select: { bids: true } },
        },
      });

      if (!existing) throw notFound('Объявление не найдено.');
      if (existing.authorId !== user.id) throw forbidden('Это не ваше объявление.');

      const mustBeSoftDeleted =
        existing.deal !== null ||
        existing.bidCount > 0 ||
        existing._count.bids > 0;

      if (mustBeSoftDeleted) {
        await app.prisma.marketEntry.update({
          where: { id },
          data: {
            deletedAt: new Date(),
            status: 'closed',
            version: { increment: 1 },
          },
        });
      } else {
        await app.prisma.marketEntry.delete({ where: { id } });
      }

      return reply.code(204).send();
    },
  );
}
