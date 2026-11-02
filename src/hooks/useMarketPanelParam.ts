import { useCallback } from 'react';
import { usePanelParams } from './usePanelParams';

export interface MarketPanelState {
  /** The placement form is open. */
  isComposing: boolean;
  /** Game preselected for the placement form, if the flow started from a game card. */
  composeGameId: string;
  /** Edition preselected for the placement form, if the flow started from an edition card. */
  composeEditionId: string;
  /** Entry whose detail card is open, empty when the drawer is closed. */
  itemId: string;
  openCompose: (gameId?: string, editionId?: string) => void;
  openItem: (itemId: string, options?: { replace?: boolean }) => void;
  closePanel: () => void;
}

/**
 * One URL-driven drawer per market page: either the placement form (`compose`)
 * or an entity card (`item`). Links and browser history work for both.
 */
export function useMarketPanelParam(): MarketPanelState {
  const { params: searchParams, update } = usePanelParams();

  const openCompose = useCallback((gameId = '', editionId = '') => {
    update({ compose: '1', item: null, game: gameId || null, editionId: editionId || null });
  }, [update]);
  const openItem = useCallback((itemId: string, options?: { replace?: boolean }) => {
    update({ item: itemId, compose: null, game: null, editionId: null }, options?.replace ?? false);
  }, [update]);
  const closePanel = useCallback(() => {
    update({ compose: null, item: null, game: null, editionId: null }, true);
  }, [update]);

  return {
    isComposing: searchParams.get('compose') === '1',
    composeGameId: searchParams.get('game') ?? '',
    composeEditionId: searchParams.get('editionId') ?? '',
    itemId: searchParams.get('item') ?? '',
    openCompose,
    openItem,
    closePanel,
  };
}
