import type { Edition, MarketEntry } from '../types';

/** Canonical releases include their language variants, never another release. */
export function gameEditionEntries(entries: readonly MarketEntry[], gameId: string, edition?: Edition): MarketEntry[] {
  const ids = new Set(edition ? [edition.id, ...(edition.variants ?? []).map(variant => variant.id)] : []);
  return entries.filter(entry => entry.gameId === gameId &&
    (entry.moderationStatus === undefined || entry.moderationStatus === 'visible') &&
    (!edition || (entry.editionId !== null && ids.has(entry.editionId))));
}