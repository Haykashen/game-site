import { YEAR_RANGES } from '../data';
import { listingTypeLabel } from './market';
import { marketItemLabel } from '@discvault/shared';
import type { CatalogFilters, Edition, Game, MarketEntry } from '../types';

/**
 * Marketplace filters run through the linked edition when there is one. A
 * "buy" listing without an edition matches a filter when any release of the
 * game satisfies it.
 */
export function selectVisibleMarketEntries(
  entries: readonly MarketEntry[],
  gamesById: ReadonlyMap<string, Game>,
  editionsById: ReadonlyMap<string, Edition>,
  editions: readonly Edition[],
  filters: CatalogFilters,
): MarketEntry[] {
  const query = filters.query.trim().toLowerCase();
  const yearRange = YEAR_RANGES.find((range) => range.value === filters.yearRange);
  const completeness = filters.completeness.toLowerCase();
  const editionsByGame = new Map<string, Edition[]>();

  for (const edition of editions) {
    const list = editionsByGame.get(edition.gameId);

    if (list) {
      list.push(edition);
    } else {
      editionsByGame.set(edition.gameId, [edition]);
    }
  }

  return entries.filter((entry) => {
    if (filters.itemType && entry.itemType !== filters.itemType) return false;
    const game = gamesById.get(entry.gameId);
    const edition = entry.editionId ? editionsById.get(entry.editionId) : undefined;
    if (!edition && entry.itemType !== 'game' && (filters.platform || filters.region || filters.edition || filters.lang)) return false;
    const gameEditions = editionsByGame.get(entry.gameId) ?? [];

    if (query) {
      const editionText = gameEditions
        .map((item) => `${item.name} ${item.platform} ${item.region} ${item.lang}`)
        .join(' ');
      const haystack = [
        entry.title,
        entry.seller,
        entry.description,
        entry.condition,
        listingTypeLabel(entry.listingType),
        marketItemLabel(entry.itemType),
        edition?.name,
        edition?.platform,
        edition?.region,
        edition?.lang,
        game?.title,
        game?.publisher,
        game?.developer,
        game?.series,
        game?.genres.join(' '),
        editionText,
      ]
        .filter((part): part is string => Boolean(part))
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(query)) return false;
    }

    if (filters.platform) {
      const matches = edition
        ? edition.platform === filters.platform
        : gameEditions.some((item) => item.platform === filters.platform);
      if (!matches) return false;
    }

    if (filters.region) {
      const matches = edition
        ? edition.region === filters.region
        : gameEditions.some((item) => item.region === filters.region);
      if (!matches) return false;
    }

    if (filters.edition) {
      const matches = edition
        ? edition.name === filters.edition
        : gameEditions.some((item) => item.name === filters.edition);
      if (!matches) return false;
    }

    if (filters.lang) {
      const matches = edition
        ? edition.lang.includes(filters.lang)
        : gameEditions.some((item) => item.lang.includes(filters.lang));
      if (!matches) return false;
    }

    if (completeness && !entry.condition.toLowerCase().includes(completeness)) return false;

    if (yearRange) {
      const year = game?.year;
      if (year === undefined || year < yearRange.min || year > yearRange.max) return false;
    }

    return true;
  });
}
