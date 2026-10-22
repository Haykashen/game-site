import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

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
  const [searchParams, setSearchParams] = useSearchParams();

  const openGame = useCallback(
    (gameId: string, editionId = '') => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set('game', gameId);

        if (editionId) next.set('editionId', editionId);
        else next.delete('editionId');

        return next;
      });
    },
    [setSearchParams],
  );

  const closeGame = useCallback(() => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('game');
        next.delete('editionId');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return {
    gameId: searchParams.get('game') ?? '',
    editionId: searchParams.get('editionId') ?? '',
    openGame,
    closeGame,
  };
}
