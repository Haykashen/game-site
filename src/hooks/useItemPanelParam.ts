import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

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
  const [searchParams, setSearchParams] = useSearchParams();
  const itemId = searchParams.get(param) ?? '';

  const openItem = useCallback(
    (nextItemId: string, options?: { replace?: boolean }) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set(param, nextItemId);
          return next;
        },
        { replace: options?.replace ?? false },
      );
    },
    [param, setSearchParams],
  );

  const closeItem = useCallback(() => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete(param);
        return next;
      },
      { replace: true },
    );
  }, [param, setSearchParams]);

  return { itemId, openItem, closeItem };
}
