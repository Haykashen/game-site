import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MarketCreateInput } from '@discvault/shared';
import {
  createDealRequest,
  createMarketEntry,
  deleteMarketEntry,
  errorMessage,
  listMarketEntries,
  mapMarketEntry,
  placeBidRequest,
  updateMarketEntry,
  updateMarketStatus,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { useCollection } from '../context/CollectionContext';
import { INITIAL_MARKET_ENTRIES } from '../data';
import { STORAGE_KEYS } from '../lib/constants';
import { formatPrice } from '../lib/formatPrice';
import { createId, parseMarketEntries } from '../lib/storage';
import type { MarketDraft, MarketEntry, MarketStatus } from '../types';
import { usePersistentState } from './usePersistentState';

export interface MarketStore {
  /** Seed entries plus the ones the current user can see. Newest first. */
  entries: readonly MarketEntry[];
  /** Ids that belong to the current user, so the UI can show owner controls. */
  ownEntryIds: ReadonlySet<string>;
  addEntry: (draft: MarketDraft) => Promise<MarketEntry | null>;
  updateEntry: (id: string, draft: MarketDraft) => Promise<MarketEntry | null>;
  removeEntry: (id: string) => Promise<boolean>;
  setEntryStatus: (id: string, status: MarketStatus) => Promise<MarketEntry | null>;
  /** Returns an error message, or `null` when the bid was accepted. */
  placeBid: (id: string, amount: number) => Promise<string | null>;
  /** Creates a deal (or marks a local demo lot as sold). */
  purchase: (id: string) => Promise<string | null>;
  refresh: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  isRemote: boolean;
}

const SEED_ENTRY_IDS = new Set(INITIAL_MARKET_ENTRIES.map((entry) => entry.id));

function draftToApiInput(draft: MarketDraft): MarketCreateInput {
  return {
    kind: draft.kind,
    listingType: draft.listingType,
    gameId: draft.gameId,
    editionId: draft.editionId,
    title: draft.title,
    condition: draft.condition,
    price: draft.price,
    description: draft.description,
    photos: draft.photos,
    deliveryServices: draft.deliveryServices,
    internationalShipping: draft.internationalShipping,
    packagingPrice: draft.packagingPrice,
    shipsFrom: draft.shipsFrom,
    bidStep: draft.bidStep,
    startsAt: draft.startsAt,
    endsAt: draft.endsAt,
  };
}

function minimumBid(entry: MarketEntry): number {
  return entry.bids > 0 ? entry.price + (entry.bidStep ?? 0) : entry.price;
}

/**
 * Marketplace store. With an authenticated API session it mirrors the server;
 * otherwise (and while the API is unavailable) it keeps the original local demo.
 */
export function useMarketEntries(): MarketStore {
  const { status, user } = useAuth();
  const { editions } = useCollection();
  const isRemote = status === 'api' && user !== null;
  const remoteUserId = user?.id;

  const parseStoredEntries = useCallback(
    (value: unknown) => parseMarketEntries(value, editions),
    [editions],
  );

  const [storedEntries, setStoredEntries] = usePersistentState<MarketEntry[]>(
    STORAGE_KEYS.market,
    [],
    parseStoredEntries,
  );
  const [remoteEntries, setRemoteEntries] = useState<MarketEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seeds stay visible even after a demo bid or purchase changes one of them.
  const localEntries = useMemo(() => {
    const storedById = new Map(storedEntries.map((entry) => [entry.id, entry]));
    const seeds = INITIAL_MARKET_ENTRIES.map(
      (entry) => storedById.get(entry.id) ?? entry,
    );
    const ownEntries = storedEntries.filter((entry) => !SEED_ENTRY_IDS.has(entry.id));

    return [...ownEntries, ...seeds];
  }, [storedEntries]);

  const localOwnEntryIds = useMemo(
    () =>
      new Set(
        storedEntries
          .filter((entry) => !SEED_ENTRY_IDS.has(entry.id))
          .map((entry) => entry.id),
      ),
    [storedEntries],
  );

  const loadRemote = useCallback(async () => {
    if (!isRemote) {
      setRemoteEntries(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [publicPage, ownPage] = await Promise.all([
        listMarketEntries({
          status: 'all',
          pageSize: 100,
          sort: 'newest',
        }),
        listMarketEntries({
          status: 'all',
          pageSize: 100,
          sort: 'newest',
          authorId: 'me',
        }),
      ]);

      // Own lots come first, including ones hidden by moderation. The public
      // page is still needed for every other seller's entries.
      const byId = new Map(ownPage.items.map((entry) => [entry.id, entry]));
      for (const entry of publicPage.items) {
        if (!byId.has(entry.id)) byId.set(entry.id, entry);
      }

      setRemoteEntries([...byId.values()].map(mapMarketEntry));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [isRemote]);

  useEffect(() => {
    void loadRemote();
  }, [loadRemote, remoteUserId]);

  const entries = useMemo(
    () => (isRemote && remoteEntries !== null ? remoteEntries : localEntries),
    [isRemote, localEntries, remoteEntries],
  );

  const ownEntryIds = useMemo(() => {
    if (!isRemote) return localOwnEntryIds;

    return new Set(
      entries
        .filter((entry) => entry.authorId === remoteUserId)
        .map((entry) => entry.id),
    );
  }, [entries, isRemote, localOwnEntryIds, remoteUserId]);

  const upsertLocalEntry = useCallback(
    (entry: MarketEntry) => {
      setStoredEntries((previous) => [
        entry,
        ...previous.filter((existing) => existing.id !== entry.id),
      ]);
    },
    [setStoredEntries],
  );

  const replaceRemoteEntry = useCallback((entry: MarketEntry) => {
    setRemoteEntries((previous) => {
      const list = previous ?? [];
      return list.some((existing) => existing.id === entry.id)
        ? list.map((existing) => (existing.id === entry.id ? entry : existing))
        : [entry, ...list];
    });
  }, []);

  const addEntry = useCallback(
    async (draft: MarketDraft): Promise<MarketEntry | null> => {
      if (isRemote) {
        try {
          const entry = mapMarketEntry(await createMarketEntry(draftToApiInput(draft)));
          replaceRemoteEntry(entry);
          setError(null);
          return entry;
        } catch (mutationError) {
          setError(errorMessage(mutationError));
          return null;
        }
      }

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
    [isRemote, replaceRemoteEntry, setStoredEntries],
  );

  const updateEntry = useCallback(
    async (id: string, draft: MarketDraft): Promise<MarketEntry | null> => {
      if (isRemote) {
        try {
          const existing = entries.find((entry) => entry.id === id);
          const payload = draftToApiInput(draft);
          const input =
            existing?.kind === 'auction' &&
            existing.bids > 0 &&
            existing.startPrice !== undefined
              ? { ...payload, price: existing.startPrice }
              : payload;

          const entry = mapMarketEntry(await updateMarketEntry(id, input));
          replaceRemoteEntry(entry);
          setError(null);
          return entry;
        } catch (mutationError) {
          setError(errorMessage(mutationError));
          return null;
        }
      }

      let updated: MarketEntry | null = null;

      setStoredEntries((previous) =>
        previous.map((entry) => {
          if (entry.id !== id) return entry;
          updated = { ...entry, ...draft };
          return updated;
        }),
      );

      return updated;
    },
    [entries, isRemote, replaceRemoteEntry, setStoredEntries],
  );

  const removeEntry = useCallback(
    async (id: string): Promise<boolean> => {
      if (isRemote) {
        try {
          await deleteMarketEntry(id);
          setRemoteEntries((previous) =>
            (previous ?? []).filter((entry) => entry.id !== id),
          );
          setError(null);
          return true;
        } catch (mutationError) {
          setError(errorMessage(mutationError));
          return false;
        }
      }

      setStoredEntries((previous) => previous.filter((entry) => entry.id !== id));
      return true;
    },
    [isRemote, setStoredEntries],
  );

  const setEntryStatus = useCallback(
    async (id: string, nextStatus: MarketStatus): Promise<MarketEntry | null> => {
      if (isRemote) {
        try {
          const entry = mapMarketEntry(
            await updateMarketStatus(id, { status: nextStatus }),
          );
          replaceRemoteEntry(entry);
          setError(null);
          return entry;
        } catch (mutationError) {
          setError(errorMessage(mutationError));
          return null;
        }
      }

      let updated: MarketEntry | null = null;

      setStoredEntries((previous) => {
        const existing = previous.find((entry) => entry.id === id);

        if (existing) {
          return previous.map((entry) => {
            if (entry.id !== id) return entry;
            updated = { ...entry, status: nextStatus };
            return updated;
          });
        }

        const seed = INITIAL_MARKET_ENTRIES.find((entry) => entry.id === id);
        if (!seed) return previous;

        updated = { ...seed, status: nextStatus };
        return [updated, ...previous];
      });

      return updated;
    },
    [isRemote, replaceRemoteEntry, setStoredEntries],
  );

  const placeBid = useCallback(
    async (id: string, amount: number): Promise<string | null> => {
      if (isRemote) {
        try {
          const response = await placeBidRequest(id, { amount });
          replaceRemoteEntry(mapMarketEntry(response.entry));
          setError(null);
          return null;
        } catch (mutationError) {
          const message = errorMessage(mutationError);
          setError(message);
          return message;
        }
      }

      const entry = localEntries.find((candidate) => candidate.id === id);

      if (!entry) return 'Лот не найден.';
      if (entry.kind !== 'auction') return 'Ставки доступны только для аукционов.';
      if (entry.status !== 'active') return 'Аукцион уже закрыт.';
      if (entry.endsAt && Date.parse(entry.endsAt) <= Date.now()) {
        return 'Аукцион уже завершён.';
      }
      if (entry.startsAt && Date.parse(entry.startsAt) > Date.now()) {
        return 'Аукцион ещё не начался.';
      }
      if (ownEntryIds.has(id)) return 'Нельзя делать ставку на собственный лот.';

      const minimum = minimumBid(entry);
      if (!Number.isSafeInteger(amount) || amount < minimum) {
        return `Минимальная ставка — ${formatPrice(minimum)}.`;
      }

      upsertLocalEntry({
        ...entry,
        startPrice: entry.startPrice ?? entry.price,
        price: amount,
        bids: entry.bids + 1,
      });
      setError(null);
      return null;
    },
    [isRemote, localEntries, ownEntryIds, replaceRemoteEntry, upsertLocalEntry],
  );

  const purchase = useCallback(
    async (id: string): Promise<string | null> => {
      if (isRemote) {
        try {
          await createDealRequest(id);
          await loadRemote();
          setError(null);
          return null;
        } catch (mutationError) {
          const message = errorMessage(mutationError);
          setError(message);
          return message;
        }
      }

      const entry = localEntries.find((candidate) => candidate.id === id);

      if (!entry) return 'Лот не найден.';
      if (entry.kind !== 'listing') return 'Сделку можно оформить только для объявления.';
      if (entry.status !== 'active') return 'Лот уже недоступен.';
      if (ownEntryIds.has(id)) return 'Это ваш лот.';

      upsertLocalEntry({ ...entry, status: 'sold' });
      setError(null);
      return null;
    },
    [isRemote, loadRemote, localEntries, ownEntryIds, upsertLocalEntry],
  );

  return {
    entries,
    ownEntryIds,
    addEntry,
    updateEntry,
    removeEntry,
    setEntryStatus,
    placeBid,
    purchase,
    refresh: loadRemote,
    isLoading,
    error,
    isRemote,
  };
}
