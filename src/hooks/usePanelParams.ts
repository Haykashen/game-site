import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Patch panel parameters without losing unrelated filters; null removes a key. */
export function usePanelParams() {
  const [params, setParams] = useSearchParams();
  const update = useCallback((patch: Record<string, string | null>, replace = false) => {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace });
  }, [setParams]);
  return { params, update };
}
