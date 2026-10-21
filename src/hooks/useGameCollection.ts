import { useCallback, useMemo } from 'react';
import { INITIAL_GAMES } from '../data';
import { mergeCatalog } from '../lib/catalog';
import { STORAGE_KEYS } from '../lib/constants';
import { createId, parseGames, parseOwnedIds } from '../lib/storage';
import type { Game, Lot, LotDraft } from '../types';
import { usePersistentState } from './usePersistentState';

export interface GameCollection {
  games: Game[];
  ownedIds: string[];
  ownedCount: number;
  isOwned: (gameId: string) => boolean;
  toggleOwned: (gameId: string) => void;
  addLot: (gameId: string, draft: LotDraft) => void;
}

/** Owns catalogue persistence and exposes the only mutations the UI needs. */
export function useGameCollection(): GameCollection {
  const [storedGames, setGames] = usePersistentState<Game[]>(
    STORAGE_KEYS.games,
    INITIAL_GAMES,
    parseGames,
  );
  const [ownedIds, setOwnedIds] = usePersistentState<string[]>(
    STORAGE_KEYS.owned,
    [],
    parseOwnedIds,
  );

  const games = useMemo(() => mergeCatalog(storedGames, INITIAL_GAMES), [storedGames]);
  const ownedSet = useMemo(() => new Set(ownedIds), [ownedIds]);

  const isOwned = useCallback((gameId: string) => ownedSet.has(gameId), [ownedSet]);

  const toggleOwned = useCallback(
    (gameId: string) => {
      setOwnedIds((previous) =>
        previous.includes(gameId)
          ? previous.filter((id) => id !== gameId)
          : [...previous, gameId],
      );
    },
    [setOwnedIds],
  );

  const addLot = useCallback(
    (gameId: string, draft: LotDraft) => {
      const lot: Lot = { ...draft, id: createId() };
      setGames((previous) =>
        previous.map((game) =>
          game.id === gameId ? { ...game, lots: [...game.lots, lot] } : game,
        ),
      );
    },
    [setGames],
  );

  return {
    games,
    ownedIds,
    ownedCount: ownedIds.length,
    isOwned,
    toggleOwned,
    addLot,
  };
}
