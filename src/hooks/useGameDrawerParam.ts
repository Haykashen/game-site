import { useCallback } from 'react';
import { usePanelParams } from './usePanelParams';

interface GameDrawerParam {
  /** Game id from the URL; empty string when the drawer is closed. */
  gameId: string;
  /** Edition preselected in the drawer; empty string when the game opens generally. */
  editionId: string;
  openGame: (gameId: string, editionId?: string) => void;
  closeGame: () => void;
}

/**
 * The URL is the source of truth for the open game drawer, so links and
 * browser history work. Opening pushes a history entry, closing replaces the
 * current one to avoid a dead step behind the user.
 */
export function useGameDrawerParam(): GameDrawerParam {
  const { params: searchParams, update } = usePanelParams();

  const openGame = useCallback((gameId: string, editionId = '') => {
    update({ game: gameId, editionId: editionId || null });
  }, [update]);
  const closeGame = useCallback(() => update({ game: null, editionId: null }, true), [update]);

  return {
    gameId: searchParams.get('game') ?? '',
    editionId: searchParams.get('editionId') ?? '',
    openGame,
    closeGame,
  };
}
