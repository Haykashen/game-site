import { useCallback, useMemo } from 'react';
import { INITIAL_MARKET_ENTRIES } from '../data';
import { STORAGE_KEYS } from '../lib/constants';
import { createId, parseMarketEntries } from '../lib/storage';
import type { MarketDraft, MarketEntry, MarketStatus } from '../types';
import { useCollection } from '../context/CollectionContext';
import { usePersistentState } from './usePersistentState';

export interface MarketStore {
  /** Seed entries plus the ones this device has placed, newest first. */
  entries: readonly MarketEntry[];
  /** Ids that belong to this device, so the UI can show owner controls. */
  ownEntryIds: ReadonlySet<string>;
  addEntry: (draft: MarketDraft) => MarketEntry;
  updateEntry: (id: string, draft: MarketDraft) => void;
  removeEntry: (id: string) => void;
  setEntryStatus: (id: string, status: MarketStatus) => void;
}

const SEED_ENTRY_IDS = new Set(INITIAL_MARKET_ENTRIES.map((entry) => entry.id));

/**
 * Marketplace store. Seeds keep the demo sections populated, while
 * localStorage only adds entries created by the user.
 */
export function useMarketEntries(): MarketStore {
  const { editions } = useCollection();
  const parseStoredEntries = useCallback(
    (value: unknown) => parseMarketEntries(value, editions),
    [editions],
  );

  const [storedEntries, setStoredEntries] = usePersistentState<MarketEntry[]>(
    STORAGE_KEYS.market,
    [],
    parseStoredEntries,
  );

  const entries = useMemo(() => {
    const userEntries = storedEntries.filter((entry) => !SEED_ENTRY_IDS.has(entry.id));
    return [...userEntries, ...INITIAL_MARKET_ENTRIES];
  }, [storedEntries]);

  const ownEntryIds = useMemo(
    () =>
      new Set(
        storedEntries
          .filter((entry) => !SEED_ENTRY_IDS.has(entry.id))
          .map((entry) => entry.id),
      ),
    [storedEntries],
  );

  const addEntry = useCallback(
    (draft: MarketDraft): MarketEntry => {
      const entry: MarketEntry = {
        ...draft,
        id: createId(),
        status: 'active',
        bids: 0,
        createdAt: new Date().toISOString(),
      };

      setStoredEntries((previous) => [entry, ...previous]);
      return entry;
    },
    [setStoredEntries],
  );

  const updateEntry = useCallback(
    (id: string, draft: MarketDraft) => {
      setStoredEntries((previous) =>
        previous.map((entry) => (entry.id === id ? { ...entry, ...draft } : entry)),
      );
    },
    [setStoredEntries],
  );

  const removeEntry = useCallback(
    (id: string) => {
      setStoredEntries((previous) => previous.filter((entry) => entry.id !== id));
    },
    [setStoredEntries],
  );

  const setEntryStatus = useCallback(
    (id: string, status: MarketStatus) => {
      setStoredEntries((previous) =>
        previous.map((entry) => (entry.id === id ? { ...entry, status } : entry)),
      );
    },
    [setStoredEntries],
  );

  return {
    entries,
    ownEntryIds,
    addEntry,
    updateEntry,
    removeEntry,
    setEntryStatus,
  };
}
