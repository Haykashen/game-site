import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCopyRequest,
  deleteEditionRequest,
  errorMessage,
  listCopies,
  mapCopy,
  setEditionQuantityRequest,
  updateCopyEditionRequest,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { INITIAL_EDITIONS, INITIAL_GAMES } from '../data';
import { mergeCatalog } from '../lib/catalog';
import { MAX_COLLECTION_QUANTITY, STORAGE_KEYS } from '../lib/constants';
import {
  createId,
  parseCopies,
  parseGames,
  parseOwnedIds,
  readStorage,
} from '../lib/storage';
import type { Copy, CopyDetails, Edition, Game } from '../types';
import { usePersistentState } from './usePersistentState';

export interface GameCollection {
  games: Game[];
  editions: Edition[];
  editionById: ReadonlyMap<string, Edition>;
  editionsByGame: ReadonlyMap<string, readonly Edition[]>;
  copies: Copy[];
  /** Unique game ids that have at least one copy on the shelf. */
  ownedIds: string[];
  ownedCount: number;
  isOwned: (gameId: string) => boolean;
  getEdition: (editionId: string) => Edition | undefined;
  getGameEditions: (gameId: string) => readonly Edition[];
  getEditionCopies: (editionId: string) => Copy[];
  addCopy: (editionId: string) => void;
  setEditionQuantity: (editionId: string, quantity: number) => void;
  updateEdition: (editionId: string, details: CopyDetails) => void;
  removeEdition: (editionId: string) => void;
  refresh: () => Promise<void>;
  isRemote: boolean;
  isSyncing: boolean;
  syncError: string | null;
}

const EMPTY_EDITIONS: readonly Edition[] = [];
const DEFAULT_DETAILS = 'Не указано';

function createCopy(editionId: string, source?: Copy): Copy {
  return {
    id: createId(),
    editionId,
    condition: source?.condition ?? DEFAULT_DETAILS,
    completeness: source?.completeness ?? DEFAULT_DETAILS,
    purchasePrice: source?.purchasePrice ?? null,
    purchaseDate: source?.purchaseDate ?? '',
    notes: source?.notes ?? '',
    // Photos are shared conceptually; keeping them on one row avoids duplicating
    // large data URLs when the quantity stepper grows.
    photos: [],
    createdAt: new Date().toISOString(),
  };
}

/** Old saves stored game ids; turn each one into a copy of the first edition. */
function createLegacyCopies(
  ownedIds: readonly string[],
  editions: readonly Edition[],
): Copy[] {
  if (ownedIds.length === 0) return [];

  const firstByGame = new Map<string, string>();

  for (const edition of editions) {
    if (!firstByGame.has(edition.gameId)) firstByGame.set(edition.gameId, edition.id);
  }

  const copies: Copy[] = [];

  for (const gameId of ownedIds) {
    const editionId = firstByGame.get(gameId);
    if (editionId) copies.push(createCopy(editionId));
  }

  return copies;
}

/** Owns catalogue, editions and the shelf; exposes the only mutations the UI needs. */
export function useGameCollection(): GameCollection {
  const { status, user } = useAuth();
  const isRemote = status === 'api' && user !== null;
  const remoteUserId = user?.id;

  const [storedGames] = usePersistentState<Game[]>(
    STORAGE_KEYS.games,
    INITIAL_GAMES,
    parseGames,
  );

  const legacyOwnedIds = useMemo(
    () => readStorage<string[]>(STORAGE_KEYS.owned, [], parseOwnedIds),
    [],
  );
  const initialCopies = useMemo(
    () => createLegacyCopies(legacyOwnedIds, INITIAL_EDITIONS),
    [legacyOwnedIds],
  );

  const [localCopies, setLocalCopies] = usePersistentState<Copy[]>(
    STORAGE_KEYS.copies,
    initialCopies,
    parseCopies,
  );
  const [remoteCopies, setRemoteCopies] = useState<Copy[] | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadRemote = useCallback(async () => {
    if (!isRemote) {
      setRemoteCopies(null);
      setIsSyncing(false);
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const copies = await listCopies();
      setRemoteCopies(copies.map(mapCopy));
    } catch (loadError) {
      setSyncError(errorMessage(loadError));
    } finally {
      setIsSyncing(false);
    }
  }, [isRemote]);

  useEffect(() => {
    void loadRemote();
  }, [loadRemote, remoteUserId]);

  const copies = useMemo(
    () => (isRemote && remoteCopies !== null ? remoteCopies : localCopies),
    [isRemote, localCopies, remoteCopies],
  );

  const games = useMemo(() => mergeCatalog(storedGames, INITIAL_GAMES), [storedGames]);

  const editionById = useMemo(
    () => new Map(INITIAL_EDITIONS.map((edition) => [edition.id, edition])),
    [],
  );

  const editionsByGame = useMemo(() => {
    const grouped = new Map<string, Edition[]>();

    for (const edition of INITIAL_EDITIONS) {
      const list = grouped.get(edition.gameId);

      if (list) {
        list.push(edition);
      } else {
        grouped.set(edition.gameId, [edition]);
      }
    }

    return grouped;
  }, []);

  const getEdition = useCallback(
    (editionId: string) => editionById.get(editionId),
    [editionById],
  );

  const getGameEditions = useCallback(
    (gameId: string) => editionsByGame.get(gameId) ?? EMPTY_EDITIONS,
    [editionsByGame],
  );

  const getEditionCopies = useCallback(
    (editionId: string) => copies.filter((copy) => copy.editionId === editionId),
    [copies],
  );

  const ownedIds = useMemo(() => {
    const ownedGameIds = new Set<string>();

    for (const copy of copies) {
      const edition = editionById.get(copy.editionId);
      if (edition) ownedGameIds.add(edition.gameId);
    }

    return games.filter((game) => ownedGameIds.has(game.id)).map((game) => game.id);
  }, [copies, editionById, games]);

  const ownedGameIdSet = useMemo(() => new Set(ownedIds), [ownedIds]);

  const isOwned = useCallback(
    (gameId: string) => ownedGameIdSet.has(gameId),
    [ownedGameIdSet],
  );

  const replaceRemoteEdition = useCallback(
    (editionId: string, nextCopies: Copy[]) => {
      setRemoteCopies((previous) => [
        ...nextCopies,
        ...(previous ?? []).filter((copy) => copy.editionId !== editionId),
      ]);
    },
    [],
  );

  const addCopy = useCallback(
    (editionId: string) => {
      if (!editionById.has(editionId)) return;

      if (isRemote) {
        void (async () => {
          try {
            const copy = mapCopy(await createCopyRequest(editionId));
            setRemoteCopies((previous) => [copy, ...(previous ?? [])]);
            setSyncError(null);
          } catch (mutationError) {
            setSyncError(errorMessage(mutationError));
          }
        })();
        return;
      }

      setLocalCopies((previous) => {
        const current = previous.filter((copy) => copy.editionId === editionId);
        if (current.length >= MAX_COLLECTION_QUANTITY) return previous;
        return [createCopy(editionId, current[0]), ...previous];
      });
    },
    [editionById, isRemote, setLocalCopies],
  );

  const setEditionQuantity = useCallback(
    (editionId: string, quantity: number) => {
      if (!editionById.has(editionId) || !Number.isFinite(quantity)) return;

      const target = Math.min(
        MAX_COLLECTION_QUANTITY,
        Math.max(0, Math.floor(quantity)),
      );

      if (isRemote) {
        void (async () => {
          try {
            const copies = await setEditionQuantityRequest(editionId, target);
            replaceRemoteEdition(editionId, copies.map(mapCopy));
            setSyncError(null);
          } catch (mutationError) {
            setSyncError(errorMessage(mutationError));
          }
        })();
        return;
      }

      setLocalCopies((previous) => {
        const current = previous.filter((copy) => copy.editionId === editionId);

        if (current.length === target) return previous;
        if (target === 0) {
          return previous.filter((copy) => copy.editionId !== editionId);
        }

        if (target > current.length) {
          const additions = Array.from(
            { length: target - current.length },
            () => createCopy(editionId, current[0]),
          );
          return [...additions, ...previous];
        }

        const removeIds = new Set(
          [...current]
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
            .slice(0, current.length - target)
            .map((copy) => copy.id),
        );

        return previous.filter((copy) => !removeIds.has(copy.id));
      });
    },
    [editionById, isRemote, replaceRemoteEdition, setLocalCopies],
  );

  const removeEdition = useCallback(
    (editionId: string) => {
      if (isRemote) {
        void (async () => {
          try {
            await deleteEditionRequest(editionId);
            setRemoteCopies((previous) =>
              (previous ?? []).filter((copy) => copy.editionId !== editionId),
            );
            setSyncError(null);
          } catch (mutationError) {
            setSyncError(errorMessage(mutationError));
          }
        })();
        return;
      }

      setLocalCopies((previous) =>
        previous.filter((copy) => copy.editionId !== editionId),
      );
    },
    [isRemote, setLocalCopies],
  );

  const updateEdition = useCallback(
    (editionId: string, details: CopyDetails) => {
      if (isRemote) {
        void (async () => {
          try {
            const copies = await updateCopyEditionRequest(editionId, details);
            replaceRemoteEdition(editionId, copies.map(mapCopy));
            setSyncError(null);
          } catch (mutationError) {
            setSyncError(errorMessage(mutationError));
          }
        })();
        return;
      }

      setLocalCopies((previous) => {
        const current = previous.filter((copy) => copy.editionId === editionId);
        if (current.length === 0) return previous;

        const representative = [...current].sort(
          (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
        )[0];
        const representativeId = representative?.id;

        return previous.map((copy) =>
          copy.editionId === editionId
            ? {
                ...copy,
                condition: details.condition,
                completeness: details.completeness,
                purchasePrice: details.purchasePrice,
                purchaseDate: details.purchaseDate,
                notes: details.notes,
                // Only one row carries the data URLs; the group shares them.
                photos: copy.id === representativeId ? details.photos : [],
              }
            : copy,
        );
      });
    },
    [isRemote, replaceRemoteEdition, setLocalCopies],
  );

  return {
    games,
    editions: INITIAL_EDITIONS,
    editionById,
    editionsByGame,
    copies,
    ownedIds,
    ownedCount: copies.length,
    isOwned,
    getEdition,
    getGameEditions,
    getEditionCopies,
    addCopy,
    setEditionQuantity,
    updateEdition,
    removeEdition,
    refresh: loadRemote,
    isRemote,
    isSyncing,
    syncError,
  };
}
