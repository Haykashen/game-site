import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import {
  catalogQuerySchema,
  editionQuerySchema,
  paginated,
  type CatalogFiltersDto,
  type EditionDetailDto,
  type GameDetailDto,
  type GameWithStatsDto,
} from '@discvault/shared';
import { notFound } from '../errors.js';
import { resolveEditionId } from '../lib/editionIdentity.js';
import { resolveYearRange, seedFilters, seedPlatforms } from '../lib/catalogData.js';
import { serializeEdition, serializeGame } from '../lib/serializers.js';
import { parse } from '../lib/validation.js';

function buildEditionFilter(query: {
  platform?: string | undefined;
  lang?: string | undefined;
  region?: string | undefined;
  edition?: string | undefined;
}): Prisma.EditionWhereInput {
  const filter: Prisma.EditionWhereInput = {canonicalId: null};

  if (query.platform) filter.platform = query.platform;
  if (query.region) filter.region = query.region;
  if (query.edition) filter.name = query.edition;
  if (query.lang) filter.lang = { contains: query.lang, mode: 'insensitive' };

  return filter;
}

export function registerCatalogRoutes(app: FastifyInstance): void {
  app.get(
    '/api/v1/catalog/games',
    { preHandler: app.optionalAuth },
    async (request, reply) => {
      const query = parse(catalogQuerySchema, request.query);
      const editionFilter = buildEditionFilter(query);
      const hasEditionFilter = Object.keys(editionFilter).length > 1;
      const yearRange = resolveYearRange(query.year);

      const and: Prisma.GameWhereInput[] = [];

      if (hasEditionFilter) and.push({ editions: { some: editionFilter } });

      if (query.q) {
        const q = query.q;
        and.push({
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { publisher: { contains: q, mode: 'insensitive' } },
            { developer: { contains: q, mode: 'insensitive' } },
            { series: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { genres: { has: q } },
            {
              editions: {
                some: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { platform: { contains: q, mode: 'insensitive' } },
                    { region: { contains: q, mode: 'insensitive' } },
                    { lang: { contains: q, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        });
      }

      if (yearRange) {
        and.push({
          year: {
            gte: yearRange.min,
            ...(yearRange.max !== undefined ? { lte: yearRange.max } : {}),
          },
        });
      }

      const where: Prisma.GameWhereInput = and.length > 0 ? { AND: and } : {};
      const skip = (query.page - 1) * query.pageSize;

      const [total, games] = await app.prisma.$transaction([
        app.prisma.game.count({ where }),
        app.prisma.game.findMany({
          where,
          orderBy: [{ title: 'asc' }, { id: 'asc' }],
          skip,
          take: query.pageSize,
          include: {
            editions: { where: {canonicalId:null}, select: { id: true, platform: true, coverImages: true }, orderBy: {id: 'asc'} },
            _count: { select: { editions: {where: {canonicalId:null}} } },
          },
        }),
      ]);

      const gameIds = games.map((game) => game.id);
      const editionIds = games.flatMap((game) => game.editions.map((edition) => edition.id));

      const marketByGame = new Map<string, {lotsCount: number; salesCount: number; purchasesCount: number; exchangeCount: number}>();
      const ownedByEdition = new Map<string, number>();

      if (gameIds.length > 0) {
        const lots = await app.prisma.marketEntry.groupBy({
          by: ['gameId', 'kind', 'listingType'],
          where: {
            gameId: { in: gameIds },
            status: 'active',
            moderationStatus: 'visible',
            author: { status: 'active' },
            deletedAt: null,
          },
          _count: { _all: true },
        });

        for (const row of lots) {
          const counts = marketByGame.get(row.gameId) ?? {lotsCount: 0, salesCount: 0, purchasesCount: 0, exchangeCount: 0};
          if (row.kind === 'auction') counts.lotsCount += row._count._all;
          else if (row.listingType === 'sale') counts.salesCount += row._count._all;
          else if (row.listingType === 'purchase') counts.purchasesCount += row._count._all;
          else if (row.listingType === 'exchange') counts.exchangeCount += row._count._all;
          marketByGame.set(row.gameId, counts);
        }

        if (request.user && editionIds.length > 0) {
          const owned = await app.prisma.copy.groupBy({
            by: ['editionId'],
            where: {
              userId: request.user.id,
              editionId: { in: editionIds },
            },
            _count: { _all: true },
          });

          for (const row of owned) {
            ownedByEdition.set(row.editionId, row._count._all);
          }
        }
      }

      const items: GameWithStatsDto[] = games.map((game) => {
        const coverImages = [...new Set([game.coverImage, ...game.editions.flatMap((edition) => edition.coverImages)].filter(Boolean))]
           .slice(0, 3);
        const platforms = [...new Set(game.editions.map((edition) => edition.platform))];
        const ownedCount = game.editions.reduce(
          (sum, edition) => sum + (ownedByEdition.get(edition.id) ?? 0),
          0,
        );

        return {
          ...serializeGame(game),
          stats: {
            platforms,
            editionCount: game._count.editions,
            ownedCount,
            ...(marketByGame.get(game.id) ?? {lotsCount: 0, salesCount: 0, purchasesCount: 0, exchangeCount: 0}),
            coverImages,
          },
        };
      });

      return reply.send(paginated(items, total, query.page, query.pageSize));
    },
  );

  app.get('/api/v1/catalog/games/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const game = await app.prisma.game.findUnique({
      where: { id },
      include: {
        editions: {
          where: {canonicalId:null},
          include: {variants:true},
          orderBy: [{ platform: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (!game) throw notFound('Игра не найдена.');

    const body: GameDetailDto = {
      ...serializeGame(game),
      editions: game.editions.map(serializeEdition),
    };

    return reply.send(body);
  });

  app.get('/api/v1/catalog/editions', async (request, reply) => {
    const query = parse(editionQuerySchema, request.query);
    const and: Prisma.EditionWhereInput[] = [{canonicalId:null}];

    if (query.gameId) and.push({ gameId: query.gameId });
    if (query.platform) and.push({ platform: query.platform });
    if (query.region) and.push({ region: query.region });
    if (query.edition) and.push({ name: query.edition });
    if (query.lang) and.push({ lang: { contains: query.lang, mode: 'insensitive' } });

    if (query.q) {
      const q = query.q;
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { platform: { contains: q, mode: 'insensitive' } },
          { region: { contains: q, mode: 'insensitive' } },
          { lang: { contains: q, mode: 'insensitive' } },
          { game: { title: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    const where: Prisma.EditionWhereInput = and.length > 0 ? { AND: and } : {};
    const skip = (query.page - 1) * query.pageSize;

    const [total, editions] = await app.prisma.$transaction([
      app.prisma.edition.count({ where }),
      app.prisma.edition.findMany({
        where,
        include: {variants:true},
        orderBy: [{ gameId: 'asc' }, { platform: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        skip,
        take: query.pageSize,
      }),
    ]);

    return reply.send(
      paginated(editions.map(serializeEdition), total, query.page, query.pageSize),
    );
  });

  app.get('/api/v1/catalog/editions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const edition = await app.prisma.edition.findUnique({
      where: { id: await resolveEditionId(app.prisma,id) },
      include: { game: true, variants:true },
    });

    if (!edition) throw notFound('Издание не найдено.');

    const body: EditionDetailDto = {
      ...serializeEdition(edition),
      game: serializeGame(edition.game),
    };

    return reply.send(body);
  });

  app.get('/api/v1/catalog/filters', async (_request, reply) => {
    const releases = await app.prisma.edition.findMany({ where: {canonicalId:null}, select: { platform: true, lang: true, region: true, name: true } });
    const unique = (key: 'platform' | 'lang' | 'region' | 'name') => [...new Set(releases.map((edition) => edition[key]))].filter(Boolean).sort();
    const body: CatalogFiltersDto = {
      platforms: unique('platform').map((name) => seedPlatforms.find((platform) => platform.name === name)
        ?? { name, group: 'Другие', color: '#64748b', textColor: '#ffffff' }),
      languages: unique('lang'),
      regions: unique('region'),
      editions: unique('name'),
      completeness: seedFilters.completeness,
      yearRanges: seedFilters.yearRanges,
    };

    return reply.send(body);
  });
}
