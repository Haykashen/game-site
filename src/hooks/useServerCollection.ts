import { useCallback, useMemo, useRef, useState } from 'react';
import { createCopyRequest, deleteEditionRequest, errorMessage, listCopies, mapCopy, setEditionQuantityRequest, updateCopyEditionRequest } from '../api';
import { fetchCatalog } from '../api/catalog';
import { useAuth } from '../context/AuthContext';
import type { Copy, CopyDetails, Edition, Game } from '../types';
import { MAX_COLLECTION_QUANTITY } from '../lib/constants';
import { useApiResource } from './useApiResource';
import { useLocation } from 'react-router-dom';

export interface GameCollection {
  games: Game[]; editions: Edition[]; copies: Copy[];
  editionById: ReadonlyMap<string, Edition>;
  editionsByGame: ReadonlyMap<string, readonly Edition[]>;
  ownedIds: string[]; ownedCount: number;
  isOwned: (gameId: string) => boolean;
  getEdition: (editionId: string) => Edition | undefined;
  getGameEditions: (gameId: string) => readonly Edition[];
  getEditionCopies: (editionId: string) => Copy[];
  addCopy: (editionId: string, details?: CopyDetails) => Promise<boolean>;
  setEditionQuantity: (editionId: string, quantity: number) => Promise<boolean>;
  updateEdition: (editionId: string, details: CopyDetails) => Promise<boolean>;
  removeEdition: (editionId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  isRemote: boolean; isSyncing: boolean; syncError: string | null;
  isCatalogLoading: boolean; catalogError: string | null;
}
const EMPTY_CATALOG: { games: Game[]; editions: Edition[] } = { games: [], editions: [] };
const EMPTY_COPIES: Copy[] = [];
const EMPTY_EDITIONS: readonly Edition[] = [];

export function useGameCollection(): GameCollection {
  const {pathname} = useLocation();
  // The games page has its own paged resource. Other existing tools still need
  // complete lookup lists for edition selectors and collection joins.
  const catalogPath = pathname.replace(/\/+$/, '').toLowerCase();
  const needsFullCatalog = catalogPath !== '' && catalogPath !== '/games';
  const { status, user } = useAuth();
  const userId = user?.id;
  const owner = useRef(userId);
  owner.current = userId;
  const isRemote = status === 'api' && Boolean(userId);
  const loadCatalog = useCallback((signal: AbortSignal) => needsFullCatalog ? fetchCatalog(signal) : Promise.resolve(EMPTY_CATALOG), [needsFullCatalog]);
  const catalog = useApiResource('catalog:' + (needsFullCatalog ? 'full' : 'paged'), loadCatalog, EMPTY_CATALOG);
  const loadCopies = useCallback(async (signal: AbortSignal) =>
    userId ? (await listCopies(signal)).map(mapCopy) : EMPTY_COPIES, [userId]);
  const shelf = useApiResource('copies:' + (userId ?? 'guest'), loadCopies, EMPTY_COPIES);
  const [mutationError, setMutationError] = useState<{ owner: string | undefined; message: string } | null>(null);
  const { games, editions } = catalog.data;
  const copies = shelf.data;
  const editionById = useMemo(() => {
    const map = new Map(editions.map((edition) => [edition.id, edition]));
    for (const edition of editions) for (const variant of edition.variants ?? []) map.set(variant.id, edition);
    return map;
  }, [editions]);
  const editionsByGame = useMemo(() => {
    const map = new Map<string, Edition[]>();
    for (const edition of editions) map.set(edition.gameId, [...(map.get(edition.gameId) ?? []), edition]);
    return map;
  }, [editions]);
  const ownedIds = useMemo(() => [...new Set(copies.flatMap((copy) => {
    const edition = editionById.get(copy.editionId);
    return edition ? [edition.gameId] : [];
  }))], [copies, editionById]);

  const mutate = useCallback(async (action: () => Promise<Copy[] | null>, editionId?: string) => {
    if (!isRemote) {
      setMutationError({ owner: userId, message: 'Войдите в аккаунт, чтобы изменить коллекцию.' });
      return false;
    }
    try {
      const changed = await action();
      if (owner.current !== userId) return false;
      shelf.setData((previous) => editionId
        ? [...(changed ?? []), ...previous.filter((copy) => copy.editionId !== editionId)]
        : [...(changed ?? []), ...previous]);
      setMutationError(null);
      return true;
    } catch (cause) {
      if (owner.current === userId) setMutationError({ owner: userId, message: errorMessage(cause) });
      return false;
    }
  }, [isRemote, shelf.setData, userId]);

  const refresh = useCallback(async () => { await Promise.all([catalog.refresh(), shelf.refresh()]); }, [catalog.refresh, shelf.refresh]);
  return {
    games, editions, copies, editionById, editionsByGame, ownedIds, ownedCount: copies.length,
    isOwned: (id) => ownedIds.includes(id),
    getEdition: (id) => editionById.get(id),
    getGameEditions: (id) => editionsByGame.get(id) ?? EMPTY_EDITIONS,
    getEditionCopies: (id) => copies.filter((copy) => copy.editionId === id),
    addCopy: (id, details) => mutate(async () => [mapCopy(await createCopyRequest(id, details))]),
    setEditionQuantity: (id, quantity) => Number.isFinite(quantity)
      ? mutate(async () => (await setEditionQuantityRequest(id, Math.min(MAX_COLLECTION_QUANTITY, Math.max(0, Math.floor(quantity))))).map(mapCopy), id)
      : Promise.resolve(false),
    updateEdition: (id, details) => mutate(async () => (await updateCopyEditionRequest(id, details)).map(mapCopy), id),
    removeEdition: (id) => mutate(async () => { await deleteEditionRequest(id); return null; }, id),
    refresh, isRemote, isSyncing: shelf.isLoading,
    syncError: (mutationError?.owner === userId ? mutationError?.message : null) ?? shelf.error,
    isCatalogLoading: catalog.isLoading, catalogError: catalog.error,
  };
}
