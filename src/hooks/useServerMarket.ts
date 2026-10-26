import { useCallback, useMemo, useRef, useState } from 'react';
import type { MarketCreateInput, MarketEntryDto, Paginated } from '@discvault/shared';
import { apiRequest, createDealRequest, createMarketEntry, deleteMarketEntry, errorMessage, mapMarketEntry, placeBidRequest, updateMarketEntry, updateMarketStatus } from '../api';
import { collectPages } from '../api/catalog';
import { useAuth } from '../context/AuthContext';
import type { MarketDraft, MarketEntry, MarketStatus } from '../types';
import { useApiResource } from './useApiResource';

export interface MarketStore {
  entries: readonly MarketEntry[]; ownEntryIds: ReadonlySet<string>;
  addEntry: (draft: MarketDraft) => Promise<MarketEntry | null>;
  updateEntry: (id: string, draft: MarketDraft) => Promise<MarketEntry | null>;
  removeEntry: (id: string) => Promise<boolean>;
  setEntryStatus: (id: string, status: MarketStatus) => Promise<MarketEntry | null>;
  placeBid: (id: string, amount: number) => Promise<string | null>;
  purchase: (id: string) => Promise<string | null>;
  refresh: () => Promise<void>; isLoading: boolean; error: string | null; isRemote: boolean;
}
const EMPTY: MarketEntry[] = [];
const input = (draft: MarketDraft): MarketCreateInput => ({ ...draft });

export function useMarketEntries(): MarketStore {
  const { user, status } = useAuth();
  const userId = user?.id;
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const load = useCallback(async (signal: AbortSignal) => {
    const list = (mine: boolean) => collectPages((page) => apiRequest<Paginated<MarketEntryDto>>(
      '/api/v1/market?status=all&sort=newest&pageSize=100&page=' + page + (mine ? '&authorId=me' : ''), { signal }));
    const [publicEntries, ownEntries] = await Promise.all([list(false), userId ? list(true) : Promise.resolve([])]);
    const combined = new Map(publicEntries.map((entry) => [entry.id, entry]));
    for (const entry of ownEntries) combined.set(entry.id, entry);
    return [...combined.values()].map(mapMarketEntry);
  }, [userId]);
  const resource = useApiResource('market:' + (userId ?? 'guest'), load, EMPTY);
  const [mutationError, setMutationError] = useState<{ owner: string | undefined; message: string } | null>(null);
  const entries = resource.data;
  const ownEntryIds = useMemo(() => new Set(entries.filter((entry) => entry.authorId === userId).map((entry) => entry.id)), [entries, userId]);

  const execute = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    if (!userId || status !== 'api') {
      setMutationError({ owner: userId, message: 'Войдите в аккаунт, чтобы выполнить это действие.' });
      return null;
    }
    try {
      const result = await action();
      if (currentUser.current !== userId) return null;
      setMutationError(null);
      return result;
    } catch (cause) {
      if (currentUser.current === userId) setMutationError({ owner: userId, message: errorMessage(cause) });
      return null;
    }
  }, [status, userId]);
  const replace = useCallback((entry: MarketEntry) => {
    if (currentUser.current !== userId) return;
    resource.setData((previous) => [entry, ...previous.filter((item) => item.id !== entry.id)]);
  }, [resource.setData, userId]);
  const saveEntry = useCallback(async (action: () => Promise<MarketEntryDto>) => {
    const dto = await execute(action);
    if (!dto) return null;
    const entry = mapMarketEntry(dto);
    replace(entry);
    return entry;
  }, [execute, replace]);

  return {
    entries, ownEntryIds, refresh: resource.refresh, isLoading: resource.isLoading,
    error: (mutationError?.owner === userId ? mutationError?.message : null) ?? resource.error,
    isRemote: status === 'api',
    addEntry: (draft) => saveEntry(() => createMarketEntry(input(draft))),
    updateEntry: (id, draft) => {
      const existing = entries.find((entry) => entry.id === id);
      return saveEntry(() => updateMarketEntry(id, { ...input(draft),
        ...(existing?.kind === 'auction' && existing.startPrice !== undefined ? { price: existing.startPrice } : {}) }));
    },
    setEntryStatus: (id, nextStatus) => saveEntry(() => updateMarketStatus(id, { status: nextStatus })),
    removeEntry: async (id) => {
      const result = await execute(async () => { await deleteMarketEntry(id); return true; });
      if (!result) return false;
      resource.setData((previous) => previous.filter((entry) => entry.id !== id));
      return true;
    },
    placeBid: async (id, amount) => {
      // Return the API's error to the form as well as the page banner.
      let message = 'Войдите в аккаунт, чтобы сделать ставку.';
      const response = await execute(async () => {
        try { return await placeBidRequest(id, { amount }); }
        catch (cause) { message = errorMessage(cause); throw cause; }
      });
      if (!response) return message;
      replace(mapMarketEntry(response.entry));
      return null;
    },
    purchase: async (id) => {
      let message = 'Войдите в аккаунт, чтобы оформить сделку.';
      const result = await execute(async () => {
        try { await createDealRequest(id); return true; }
        catch (cause) { message = errorMessage(cause); throw cause; }
      });
      if (!result) return message;
      await resource.refresh();
      return null;
    },
  };
}
