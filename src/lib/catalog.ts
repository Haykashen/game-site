import type { Game } from '../types';

/**
 * Catalogue metadata is owned by the bundled seeds, while localStorage only
 * keeps user lots. Merging on read lets old saves keep their lots when new
 * fields or new seed games are added, instead of falling back to the seeds.
 */
export function mergeCatalog(stored: readonly Game[], seeds: readonly Game[]): Game[] {
  const storedById = new Map(stored.map((game) => [game.id, game]));
  const seedIds = new Set(seeds.map((game) => game.id));

  const merged = seeds.map((seed) => {
    const existing = storedById.get(seed.id);
    return existing ? { ...seed, lots: existing.lots } : seed;
  });

  for (const game of stored) {
    if (!seedIds.has(game.id)) merged.push(game);
  }

  return merged;
}
