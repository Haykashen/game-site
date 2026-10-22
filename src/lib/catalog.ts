import type { Game } from '../types';

/**
 * Catalogue metadata is owned by the bundled seeds. Only games that do not
 * exist in the seeds are kept from localStorage, so old saves cannot bring back
 * removed release-level fields on the abstract game record.
 */
export function mergeCatalog(stored: readonly Game[], seeds: readonly Game[]): Game[] {
  const seedIds = new Set(seeds.map((game) => game.id));
  const merged = seeds.map((seed) => ({ ...seed }));

  for (const game of stored) {
    if (!seedIds.has(game.id)) merged.push(game);
  }

  return merged;
}
