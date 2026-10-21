import { YEAR_RANGES } from '../data';
import type { CatalogFilters, Game } from '../types';

/** Pure filtering logic, kept outside React so it is trivial to test. */
export function selectVisibleGames(
  games: readonly Game[],
  filters: CatalogFilters,
): Game[] {
  const query = filters.query.trim().toLowerCase();
  const yearRange = YEAR_RANGES.find((range) => range.value === filters.yearRange);

  return games.filter((game) => {
    if (query && !game.title.toLowerCase().includes(query)) return false;
    if (filters.platform && game.platform !== filters.platform) return false;
    if (filters.lang && !game.lang.includes(filters.lang)) return false;
    if (yearRange && (game.year < yearRange.min || game.year > yearRange.max)) return false;
    return true;
  });
}
