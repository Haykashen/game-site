import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface MarketPanelState {
  /** The placement form is open. */
  isComposing: boolean;
  /** Game preselected for the placement form, if the flow started from a game card. */
  composeGameId: string;
  /** Entry whose detail card is open, empty when the drawer is closed. */
  itemId: string;
  openCompose: (gameId?: string) => void;
  openItem: (itemId: string, options?: { replace?: boolean }) => void;
  closePanel: () => void;
}

/**
 * One URL-driven drawer per market page: either the placement form (`compose`)
 * or an entity card (`item`). Links and browser history work for both.
 */
export function useMarketPanelParam(): MarketPanelState {
  const [searchParams, setSearchParams] = useSearchParams();

  const openCompose = useCallback(
    (gameId = '') => {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous);
        next.set('compose', '1');
        next.delete('item');

        if (gameId) next.set('game', gameId);
        else next.delete('game');

        return next;
      });
    },
    [setSearchParams],
  );

  const openItem = useCallback(
    (itemId: string, options?: { replace?: boolean }) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('item', itemId);
          next.delete('compose');
          next.delete('game');
          return next;
        },
        { replace: options?.replace ?? false },
      );
    },
    [setSearchParams],
  );

  const closePanel = useCallback(() => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('compose');
        next.delete('item');
        next.delete('game');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return {
    isComposing: searchParams.get('compose') === '1',
    composeGameId: searchParams.get('game') ?? '',
    itemId: searchParams.get('item') ?? '',
    openCompose,
    openItem,
    closePanel,
  };
}
