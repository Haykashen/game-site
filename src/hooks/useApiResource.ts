import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';

/** API-only state. Responses and mutations cannot cross account boundaries. */
export function useApiResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>, empty: T) {
  const { status } = useAuth();
  const identity = key + ':' + status;
  const currentKey = useRef(identity);
  currentKey.current = identity;
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [state, setState] = useState({ key: identity, data: empty, loading: true, error: null as string | null });

  const refresh = useCallback(async () => {
    if (status !== 'api') return;
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    const request = ++sequence.current;
    setState((previous) => ({ key: identity, data: previous.key === identity ? previous.data : empty, loading: true, error: null }));
    try {
      const data = await load(next.signal);
      if (currentKey.current === identity && request === sequence.current && !next.signal.aborted) {
        setState({ key: identity, data, loading: false, error: null });
      }
    } catch (cause) {
      if (currentKey.current === identity && request === sequence.current && !next.signal.aborted) {
        setState({ key: identity, data: empty, loading: false, error: errorMessage(cause) });
      }
    }
  }, [empty, identity, load, status]);

  useEffect(() => {
    void refresh();
    return () => { controller.current?.abort(); sequence.current += 1; };
  }, [refresh]);

  const setData = useCallback((update: SetStateAction<T>) => {
    if (currentKey.current !== identity) return;
    controller.current?.abort();
    sequence.current += 1;
    setState((previous) => {
      const data = previous.key === identity ? previous.data : empty;
      return { key: identity, data: typeof update === 'function' ? (update as (value: T) => T)(data) : update, loading: false, error: null };
    });
  }, [empty, identity]);

  return {
    data: state.key === identity && status === 'api' ? state.data : empty,
    isLoading: status === 'checking' || (status === 'api' && (state.key !== identity || state.loading)),
    error: status === 'offline' ? 'Сервер недоступен. Проверьте соединение и повторите загрузку.' : state.key === identity ? state.error : null,
    refresh, setData,
  };
}
