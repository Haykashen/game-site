import { useCallback, useMemo } from 'react';
import { INITIAL_EDITIONS, INITIAL_GAMES } from '../data';
import { mergeCatalog } from '../lib/catalog';
import { MAX_COLLECTION_QUANTITY, STORAGE_KEYS } from '../lib/constants';
import { createId, parseCopies, parseGames, parseOwnedIds, readStorage } from '../lib/storage';
import type { Copy, Edition, Game } from '../types';
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
  removeEdition: (editionId: string) => void;
}

const EMPTY_EDITIONS: readonly Edition[] = [];

function createCopy(editionId: string): Copy {
  return {
    id: createId(),
    editionId,
    condition: 'Не указано',
    completeness: 'Не указано',
    notes: '',
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

  const [copies, setCopies] = usePersistentState<Copy[]>(
    STORAGE_KEYS.copies,
    initialCopies,
    parseCopies,
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

  const addCopy = useCallback(
    (editionId: string) => {
      if (!editionById.has(editionId)) return;

      setCopies((previous) => {
        const owned = previous.filter((copy) => copy.editionId === editionId).length;
        if (owned >= MAX_COLLECTION_QUANTITY) return previous;
        return [createCopy(editionId), ...previous];
      });
    },
    [editionById, setCopies],
  );

  const setEditionQuantity = useCallback(
    (editionId: string, quantity: number) => {
      if (!editionById.has(editionId) || !Number.isFinite(quantity)) return;

      const target = Math.min(
        MAX_COLLECTION_QUANTITY,
        Math.max(0, Math.floor(quantity)),
      );

      setCopies((previous) => {
        const current = previous.filter((copy) => copy.editionId === editionId);

        if (current.length === target) return previous;
        if (target === 0) {
          return previous.filter((copy) => copy.editionId !== editionId);
        }

        if (target > current.length) {
          const additions = Array.from(
            { length: target - current.length },
            () => createCopy(editionId),
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
    [editionById, setCopies],
  );

  const removeEdition = useCallback(
    (editionId: string) => {
      setCopies((previous) => previous.filter((copy) => copy.editionId !== editionId));
    },
    [setCopies],
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
    removeEdition,
  };
}
