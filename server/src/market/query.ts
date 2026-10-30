import type { Prisma } from '@prisma/client';
import { MARKET_ITEM_OPTIONS, type MarketSearchQuery } from '@discvault/shared';
import { resolveYearRange } from '../lib/catalogData.js';

export function buildMarketWhere(
  query: MarketSearchQuery,
  authorId: string | undefined,
  includeModeration = false,
): Prisma.MarketEntryWhereInput {
  const and: Prisma.MarketEntryWhereInput[] = [{ deletedAt: null }];

  if (!includeModeration) {
    and.push({ moderationStatus: 'visible' });
    and.push({ author: { status: 'active' } });
  }

  if (query.status !== 'all') and.push({ status: query.status });
  if (query.kind) and.push({ kind: query.kind });
  if (query.itemType) and.push({ itemType: query.itemType });
  if (query.listingType) and.push({ listingType: query.listingType });
  if (query.gameId) and.push({ gameId: query.gameId });
  if (query.editionId) and.push({ editionId: query.editionId });
  if (authorId) and.push({ authorId });

  const editionFilter: Prisma.EditionWhereInput = {};
  if (query.platform) editionFilter.platform = query.platform;
  if (query.region) editionFilter.region = {is:{code:query.region}};
  if (query.edition) editionFilter.name = query.edition;
  if (query.lang) editionFilter.lang = { contains: query.lang, mode: 'insensitive' };
  if (Object.keys(editionFilter).length > 0) {
    and.push({ edition: { is: editionFilter } });
  }

  if (query.completeness) {
    and.push({ condition: { contains: query.completeness, mode: 'insensitive' } });
  }

  const yearRange = resolveYearRange(query.year);
  if (yearRange) {
    and.push({
      game: {
        year: {
          gte: yearRange.min,
          ...(yearRange.max !== undefined ? { lte: yearRange.max } : {}),
        },
      },
    });
  }

  if (query.q) {
    const q = query.q;
    and.push({
      OR: [
        { itemType: { in: MARKET_ITEM_OPTIONS.filter((option) => option.label.toLowerCase().includes(q.toLowerCase())).map((option) => option.value) } },
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { condition: { contains: q, mode: 'insensitive' } },
        { shipsFrom: { contains: q, mode: 'insensitive' } },
        { author: { displayName: { contains: q, mode: 'insensitive' } } },
        { game: { title: { contains: q, mode: 'insensitive' } } },
        { edition: { name: { contains: q, mode: 'insensitive' } } },
        { edition: { platform: { contains: q, mode: 'insensitive' } } },
        { edition: { region: {is:{code:{contains:q,mode:'insensitive'}}} } },
        { edition: { lang: { contains: q, mode: 'insensitive' } } },
      ],
    });
  }

  return { AND: and };
}

export function buildMarketOrderBy(
  sort: MarketSearchQuery['sort'],
): Prisma.MarketEntryOrderByWithRelationInput[] {
  switch (sort) {
    case 'oldest':
      return [{ createdAt: 'asc' }];
    case 'endingSoon':
      return [{ endsAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }];
    case 'priceAsc':
      return [{ priceMinor: 'asc' }, { createdAt: 'desc' }];
    case 'priceDesc':
      return [{ priceMinor: 'desc' }, { createdAt: 'desc' }];
    case 'newest':
    default:
      return [{ createdAt: 'desc' }];
  }
}
