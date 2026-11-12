import type { Edition, MarketEntry } from '../types';

/** Match market entries to the selected edition. */
export function gameEditionEntries(entries: readonly MarketEntry[], gameId: string, edition?: Edition): MarketEntry[] {
  const ids = new Set(edition ? [edition.id] : []);
  return entries.filter(entry => entry.gameId === gameId &&
    (entry.moderationStatus === undefined || entry.moderationStatus === 'visible') &&
    (!edition || (entry.editionId !== null && ids.has(entry.editionId))));
}