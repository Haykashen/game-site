import { YEAR_RANGES } from '../data/reference';
import type { CatalogFilters, Edition, Game } from '../types';

/**
 * The catalogue filters games through their editions: a game matches a platform
 * or region when at least one of its releases does.
 */
export function selectVisibleGames(
  games: readonly Game[],
  editions: readonly Edition[],
  filters: CatalogFilters,
): Game[] {
  const query = filters.query.trim().toLowerCase();
  const yearRange = YEAR_RANGES.find((range) => range.value === filters.yearRange);
  const editionsByGame = new Map<string, Edition[]>();

  for (const edition of editions) {
    const list = editionsByGame.get(edition.gameId);

    if (list) {
      list.push(edition);
    } else {
      editionsByGame.set(edition.gameId, [edition]);
    }
  }

  return games.filter((game) => {
    const gameEditions = editionsByGame.get(game.id) ?? [];

    if (query) {
      const editionText = gameEditions
        .map((edition) => `${edition.name} ${edition.platform} ${edition.region} ${edition.lang}`)
        .join(' ');
      const haystack = [
        game.title,
        game.publisher,
        game.developer,
        game.series,
        game.genres.join(' '),
        editionText,
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(query)) return false;
    }

    if (filters.platform && !gameEditions.some((edition) => edition.platform === filters.platform)) {
      return false;
    }

    if (filters.lang && !gameEditions.some((edition) => edition.lang.includes(filters.lang))) {
      return false;
    }

    if (filters.region && !gameEditions.some((edition) => edition.region === filters.region)) {
      return false;
    }

    if (filters.edition && !gameEditions.some((edition) => edition.name === filters.edition)) {
      return false;
    }

    if (yearRange && (game.year === null || game.year < yearRange.min || game.year > yearRange.max)) return false;

    return true;
  });
}
