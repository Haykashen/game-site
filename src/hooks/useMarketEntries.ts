import { useCallback, useMemo } from 'react';
import { INITIAL_MARKET_ENTRIES } from '../data';
import { STORAGE_KEYS } from '../lib/constants';
import { createId, parseMarketEntries } from '../lib/storage';
import type { MarketDraft, MarketEntry } from '../types';
import { usePersistentState } from './usePersistentState';

export interface MarketStore {
  /** Seed entries plus the ones this device has placed, newest first. */
  entries: readonly MarketEntry[];
  addEntry: (draft: MarketDraft) => MarketEntry;
}

/**
 * Marketplace store. Seeds keep the demo sections populated, while
 * localStorage only adds entries created by the user.
 */
export function useMarketEntries(): MarketStore {
  const [storedEntries, setStoredEntries] = usePersistentState<MarketEntry[]>(
    STORAGE_KEYS.market,
    [],
    parseMarketEntries,
  );

  const entries = useMemo(() => {
    const seedIds = new Set(INITIAL_MARKET_ENTRIES.map((entry) => entry.id));
    const userEntries = storedEntries.filter((entry) => !seedIds.has(entry.id));
    return [...userEntries, ...INITIAL_MARKET_ENTRIES];
  }, [storedEntries]);

  const addEntry = useCallback(
    (draft: MarketDraft): MarketEntry => {
      const entry: MarketEntry = {
        ...draft,
        id: createId(),
        bids: 0,
        createdAt: new Date().toISOString(),
      };

      setStoredEntries((previous) => [entry, ...previous]);
      return entry;
    },
    [setStoredEntries],
  );

  return { entries, addEntry };
}
