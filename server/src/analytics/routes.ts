import type { FastifyInstance } from 'fastify';
import {
  analyticsQuerySchema,
  type AdminAnalyticsDto,
  type AnalyticsGameDto,
  type AnalyticsPeriod,
  type AnalyticsRoleDto,
  type AnalyticsTrendDto,
  type AnalyticsTrendPointDto,
  type AnalyticsUserDto,
} from '@discvault/shared';
import { requireRoles } from '../auth/authorization.js';
import { parse } from '../lib/validation.js';

const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

const DAY_MS = 24 * 60 * 60 * 1000;

const dayLabelFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
});

const monthLabelFormatter = new Intl.DateTimeFormat('ru-RU', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});

function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

function startOfUtcMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function addUtcDays(value: Date, amount: number): Date {
  return new Date(value.getTime() + amount * DAY_MS);
}

function addUtcMonths(value: Date, amount: number): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + amount, 1),
  );
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function dayKey(value: Date): string {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(
    value.getUTCDate(),
  )}`;
}

function monthKey(value: Date): string {
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}`;
}

function buildTrend(
  period: AnalyticsPeriod,
  start: Date,
  now: Date,
  users: Date[],
  entries: Date[],
  deals: Date[],
): AnalyticsTrendDto {
  const monthly = period === '365d';
  const buckets: AnalyticsTrendPointDto[] = [];
  const bucketIndex = new Map<string, number>();
  const end = monthly ? startOfUtcMonth(now) : startOfUtcDay(now);
  let cursor = monthly ? startOfUtcMonth(start) : startOfUtcDay(start);

  while (cursor.getTime() <= end.getTime()) {
    const key = monthly ? monthKey(cursor) : dayKey(cursor);
    const label = monthly
      ? monthLabelFormatter.format(cursor)
      : dayLabelFormatter.format(cursor);

    bucketIndex.set(key, buckets.length);
    buckets.push({ date: key, label, users: 0, entries: 0, deals: 0 });
    cursor = monthly ? addUtcMonths(cursor, 1) : addUtcDays(cursor, 1);
  }

  const addDates = (
    dates: Date[],
    field: 'users' | 'entries' | 'deals',
  ): void => {
    for (const date of dates) {
      const key = monthly ? monthKey(date) : dayKey(date);
      const index = bucketIndex.get(key);
      if (index === undefined) continue;

      const bucket = buckets[index];
      if (bucket) bucket[field] += 1;
    }
  };

  addDates(users, 'users');
  addDates(entries, 'entries');
  addDates(deals, 'deals');

  return { bucket: monthly ? 'month' : 'day', points: buckets };
}

function topGroups<T extends { _count: { _all: number } }>(
  groups: T[],
  limit: number,
): T[] {
  return [...groups]
    .sort((left, right) => right._count._all - left._count._all)
    .slice(0, limit);
}

function topMoneyGroups<
  T extends {
    _count: { _all: number };
    _sum: { amountMinor: number | null };
  },
>(groups: T[], limit: number): T[] {
  return [...groups]
    .sort(
      (left, right) =>
        (right._sum.amountMinor ?? 0) - (left._sum.amountMinor ?? 0) ||
        right._count._all - left._count._all,
    )
    .slice(0, limit);
}

export function registerAnalyticsRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/admin/analytics',
    { preHandler: app.authenticate },
    async (request, reply) => {
      requireRoles(request);

      const query = parse(analyticsQuerySchema, request.query);
      const period = query.period;
      const now = new Date();
      const start = addUtcDays(
        startOfUtcDay(now),
        -(PERIOD_DAYS[period] - 1),
      );
      const prisma = app.prisma;

      const [
        totalGames,
        newGames,
        totalEditions,
        totalCopies,
        totalUsers,
        activeUsers,
        suspendedUsers,
        newUsers,
        userCollectionGroups,
        userListingGroups,
        activeListings,
        activeAuctions,
        completedDeals,
        gmvAggregate,
        totalBids,
        pendingReports,
        pendingMarketEntries,
        entriesInPeriod,
        completedDealsInPeriod,
        gmvInPeriodAggregate,
        roleGroups,
        trendUsers,
        trendEntries,
        trendDeals,
      ] = await Promise.all([
        prisma.game.count(),
        prisma.game.count({ where: { createdAt: { gte: start } } }),
        prisma.edition.count(),
        prisma.copy.count(),
        prisma.user.count(),
        prisma.user.count({ where: { status: 'active' } }),
        prisma.user.count({ where: { status: 'suspended' } }),
        prisma.user.count({ where: { createdAt: { gte: start } } }),
        prisma.copy.groupBy({ by: ['userId'] }),
        prisma.marketEntry.groupBy({
          by: ['authorId'],
          where: { deletedAt: null },
        }),
        prisma.marketEntry.count({
          where: {
            kind: 'listing',
            status: 'active',
            moderationStatus: 'visible',
            author: { status: 'active' },
            deletedAt: null,
          },
        }),
        prisma.marketEntry.count({
          where: {
            kind: 'auction',
            status: 'active',
            moderationStatus: 'visible',
            author: { status: 'active' },
            deletedAt: null,
          },
        }),
        prisma.deal.count({ where: { status: 'completed' } }),
        prisma.deal.aggregate({
          where: { status: 'completed' },
          _sum: { amountMinor: true },
        }),
        prisma.bid.count(),
        prisma.report.count({ where: { status: 'pending' } }),
        prisma.marketEntry.count({
          where: { moderationStatus: 'pending', deletedAt: null },
        }),
        prisma.marketEntry.count({
          where: { createdAt: { gte: start }, deletedAt: null },
        }),
        prisma.deal.count({
          where: { status: 'completed', createdAt: { gte: start } },
        }),
        prisma.deal.aggregate({
          where: { status: 'completed', createdAt: { gte: start } },
          _sum: { amountMinor: true },
        }),
        prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
        prisma.user.findMany({
          where: { createdAt: { gte: start } },
          select: { createdAt: true },
        }),
        prisma.marketEntry.findMany({
          where: { createdAt: { gte: start }, deletedAt: null },
          select: { createdAt: true },
        }),
        prisma.deal.findMany({
          where: { status: 'completed', createdAt: { gte: start } },
          select: { createdAt: true },
        }),
      ]);

      const entryGroups = await prisma.marketEntry.groupBy({
        by: ['gameId'],
        where: { deletedAt: null, createdAt: { gte: start } },
        _count: { _all: true },
        _sum: { bidCount: true },
      });
      const rankedEntryGroups = topGroups(entryGroups, 8);
      const gameIds = rankedEntryGroups.map((group) => group.gameId);

      const games = gameIds.length
        ? await prisma.game.findMany({
            where: { id: { in: gameIds } },
            select: {
              id: true,
              title: true,
              coverImage: true,
              year: true,
              publisher: true,
              editions: { select: { id: true } },
              _count: { select: { subscriptions: true } },
            },
          })
        : [];
      const gamesById = new Map(games.map((game) => [game.id, game]));
      const editionToGame = new Map<string, string>();
      for (const game of games) {
        for (const edition of game.editions) {
          editionToGame.set(edition.id, game.id);
        }
      }
      const editionIds = [...editionToGame.keys()];

      const copyGroups = editionIds.length
        ? await prisma.copy.groupBy({
            by: ['editionId'],
            where: { editionId: { in: editionIds } },
            _count: { _all: true },
          })
        : [];

      const [statusGroups, dealRows, ratingGroups] = gameIds.length
        ? await Promise.all([
            prisma.marketEntry.groupBy({
              by: ['gameId', 'status'],
              where: {
                gameId: { in: gameIds },
                deletedAt: null,
                createdAt: { gte: start },
                moderationStatus: 'visible',
                author: { status: 'active' },
              },
              _count: { _all: true },
            }),
            prisma.deal.findMany({
              where: {
                status: 'completed',
                createdAt: { gte: start },
                marketEntry: { gameId: { in: gameIds } },
              },
              select: {
                amountMinor: true,
                marketEntry: { select: { gameId: true } },
              },
            }),
            prisma.gameRating.groupBy({
              by: ['gameId'],
              where: { gameId: { in: gameIds } },
              _avg: { score: true },
              _count: { _all: true },
            }),
          ])
        : [[], [], []];

      const copiesByGame = new Map<string, number>();
      for (const group of copyGroups) {
        const gameId = editionToGame.get(group.editionId);
        if (!gameId) continue;

        copiesByGame.set(
          gameId,
          (copiesByGame.get(gameId) ?? 0) + group._count._all,
        );
      }

      const statusByGame = new Map<
        string,
        { active: number; sold: number }
      >();
      for (const group of statusGroups) {
        const current = statusByGame.get(group.gameId) ?? {
          active: 0,
          sold: 0,
        };

        if (group.status === 'active') current.active += group._count._all;
        if (group.status === 'sold') current.sold += group._count._all;
        statusByGame.set(group.gameId, current);
      }

      const dealsByGame = new Map<
        string,
        { deals: number; gmvMinor: number }
      >();
      for (const deal of dealRows) {
        const gameId = deal.marketEntry.gameId;
        const current = dealsByGame.get(gameId) ?? {
          deals: 0,
          gmvMinor: 0,
        };

        current.deals += 1;
        current.gmvMinor += deal.amountMinor;
        dealsByGame.set(gameId, current);
      }

      const ratingsByGame = new Map<
        string,
        { rating: number | null; count: number }
      >();
      for (const group of ratingGroups) {
        const average = group._avg.score;
        ratingsByGame.set(group.gameId, {
          rating:
            average === null ? null : Math.round(average * 10) / 10,
          count: group._count._all,
        });
      }

      const topGames: AnalyticsGameDto[] = [];
      for (const group of rankedEntryGroups) {
        const game = gamesById.get(group.gameId);
        if (!game) continue;

        const dealStats = dealsByGame.get(game.id) ?? {
          deals: 0,
          gmvMinor: 0,
        };
        const status = statusByGame.get(game.id) ?? {
          active: 0,
          sold: 0,
        };
        const rating = ratingsByGame.get(game.id) ?? {
          rating: null,
          count: 0,
        };

        topGames.push({
          id: game.id,
          title: game.title,
          coverImage: game.coverImage,
          year: game.year,
          publisher: game.publisher,
          editions: game.editions.length,
          copies: copiesByGame.get(game.id) ?? 0,
          entries: group._count._all,
          activeEntries: status.active,
          soldEntries: status.sold,
          bids: group._sum.bidCount ?? 0,
          deals: dealStats.deals,
          gmvMinor: dealStats.gmvMinor,
          averageDealMinor:
            dealStats.deals > 0
              ? Math.round(dealStats.gmvMinor / dealStats.deals)
              : 0,
          subscriptions: game._count.subscriptions,
          rating: rating.rating,
          ratingsCount: rating.count,
        });
      }

      const [sellerGroups, buyerGroups, collectorGroups] = await Promise.all([
        prisma.deal.groupBy({
          by: ['sellerId'],
          where: { status: 'completed', createdAt: { gte: start } },
          _count: { _all: true },
          _sum: { amountMinor: true },
        }),
        prisma.deal.groupBy({
          by: ['buyerId'],
          where: { status: 'completed', createdAt: { gte: start } },
          _count: { _all: true },
          _sum: { amountMinor: true },
        }),
        prisma.copy.groupBy({
          by: ['userId'],
          _count: { _all: true },
        }),
      ]);

      const topSellerGroups = topMoneyGroups(sellerGroups, 5);
      const topBuyerGroups = topMoneyGroups(buyerGroups, 5);
      const topCollectorGroups = topGroups(collectorGroups, 5);
      const userIds = [
        ...new Set([
          ...topSellerGroups.map((group) => group.sellerId),
          ...topBuyerGroups.map((group) => group.buyerId),
          ...topCollectorGroups.map((group) => group.userId),
        ]),
      ];

      const [userRows, listingGroups, userCopyGroups] = userIds.length
        ? await Promise.all([
            prisma.user.findMany({
              where: { id: { in: userIds } },
              select: {
                id: true,
                displayName: true,
                avatarUrl: true,
                role: true,
                status: true,
              },
            }),
            prisma.marketEntry.groupBy({
              by: ['authorId'],
              where: { authorId: { in: userIds }, deletedAt: null },
              _count: { _all: true },
            }),
            prisma.copy.groupBy({
              by: ['userId'],
              where: { userId: { in: userIds } },
              _count: { _all: true },
            }),
          ])
        : [[], [], []];

      const usersById = new Map(userRows.map((user) => [user.id, user]));
      const listingCounts = new Map<string, number>();
      for (const group of listingGroups) {
        listingCounts.set(group.authorId, group._count._all);
      }
      const userCopyCounts = new Map<string, number>();
      for (const group of userCopyGroups) {
        userCopyCounts.set(group.userId, group._count._all);
      }

      const makeUserRow = (
        id: string,
        deals: number,
        gmvMinor: number,
      ): AnalyticsUserDto | null => {
        const user = usersById.get(id);
        if (!user) return null;

        return {
          id: user.id,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          role: user.role,
          status: user.status,
          deals,
          gmvMinor,
          listings: listingCounts.get(user.id) ?? 0,
          copies: userCopyCounts.get(user.id) ?? 0,
        };
      };

      const topSellers: AnalyticsUserDto[] = [];
      for (const group of topSellerGroups) {
        const row = makeUserRow(
          group.sellerId,
          group._count._all,
          group._sum.amountMinor ?? 0,
        );
        if (row) topSellers.push(row);
      }

      const topBuyers: AnalyticsUserDto[] = [];
      for (const group of topBuyerGroups) {
        const row = makeUserRow(
          group.buyerId,
          group._count._all,
          group._sum.amountMinor ?? 0,
        );
        if (row) topBuyers.push(row);
      }

      const topCollectors: AnalyticsUserDto[] = [];
      for (const group of topCollectorGroups) {
        const row = makeUserRow(group.userId, 0, 0);
        if (row) topCollectors.push(row);
      }

      const roles: AnalyticsRoleDto[] = (
        ['admin', 'moderator', 'user'] as const
      ).map((role) => ({
        role,
        count:
          roleGroups.find((group) => group.role === role)?._count._all ?? 0,
      }));

      const response: AdminAnalyticsDto = {
        period,
        generatedAt: now.toISOString(),
        overview: {
          games: {
            total: totalGames,
            editions: totalEditions,
            copies: totalCopies,
            newInPeriod: newGames,
          },
          users: {
            total: totalUsers,
            active: activeUsers,
            suspended: suspendedUsers,
            newInPeriod: newUsers,
            withCollection: userCollectionGroups.length,
            withListings: userListingGroups.length,
          },
          market: {
            activeListings,
            activeAuctions,
            entriesInPeriod,
            completedDeals,
            completedDealsInPeriod,
            gmvMinor: gmvAggregate._sum.amountMinor ?? 0,
            gmvInPeriodMinor: gmvInPeriodAggregate._sum.amountMinor ?? 0,
            bids: totalBids,
          },
          moderation: {
            pendingReports,
            pendingMarketEntries,
          },
        },
        trend: buildTrend(
          period,
          start,
          now,
          trendUsers.map((row) => row.createdAt),
          trendEntries.map((row) => row.createdAt),
          trendDeals.map((row) => row.createdAt),
        ),
        topGames,
        topSellers,
        topBuyers,
        topCollectors,
        roles,
      };

      return reply.send(response);
    },
  );
}
