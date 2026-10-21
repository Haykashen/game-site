import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

interface GameDrawerParam {
  /** Game id from the URL; empty string when the drawer is closed. */
  gameId: string;
  openGame: (gameId: string) => void;
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
    (gameId: string) => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set('game', gameId);
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
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return { gameId: searchParams.get('game') ?? '', openGame, closeGame };
}
