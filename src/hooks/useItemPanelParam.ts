import { useCallback } from 'react';
import { usePanelParams } from './usePanelParams';

export interface ItemPanelState {
  /** Entity whose detail card is open, empty when the drawer is closed. */
  itemId: string;
  openItem: (itemId: string, options?: { replace?: boolean }) => void;
  closeItem: () => void;
}

/**
 * URL-driven detail drawer for community feeds. Opening pushes a history step;
 * closing replaces it so the back button does not reopen the same card.
 */
export function useItemPanelParam(param = 'item'): ItemPanelState {
  const { params: searchParams, update } = usePanelParams();
  const itemId = searchParams.get(param) ?? '';

  const openItem = useCallback((nextItemId: string, options?: { replace?: boolean }) => {
    update({ [param]: nextItemId }, options?.replace ?? false);
  }, [param, update]);
  const closeItem = useCallback(() => update({ [param]: null }, true), [param, update]);

  return { itemId, openItem, closeItem };
}
