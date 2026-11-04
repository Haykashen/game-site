import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { API_MUTATION_EVENT, ApiError, apiRequest } from '../api/client';
import { useAuth } from './AuthContext';

const ChatsContext = createContext(0);
/** One badge request shared by all navigation surfaces, isolated by account. */
export function ChatsProvider({children}: {children: ReactNode}) {
  const {user, status} = useAuth();
  const identity = user?.id ?? '';
  const enabled = Boolean(identity) && status === 'api';
  const [result, setResult] = useState({identity: '', count: 0});
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let busy = false, again = false;
    const refresh = async () => {
      if (controller.signal.aborted || document.visibilityState === 'hidden') return;
      if (busy) {again = true; return;}
      busy = true;
      try {
        const {count} = await apiRequest<{count: number}>('/api/v1/chats/unread-count', {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        if (!controller.signal.aborted) setResult({identity, count: Math.max(0, count)});
      } catch (error) {
        if (!controller.signal.aborted && error instanceof ApiError && [401, 403].includes(error.status)) setResult({identity, count: 0});
      } finally {
        busy = false;
        if (again && !controller.signal.aborted) {again = false; void refresh();}
      }
    };
    const update = () => {void refresh();};
    update();
    const timer = window.setInterval(update, 10000);
    window.addEventListener('focus', update);
    window.addEventListener('online', update);
    window.addEventListener(API_MUTATION_EVENT, update);
    document.addEventListener('visibilitychange', update);
    return () => {
      controller.abort(); window.clearInterval(timer);
      window.removeEventListener('focus', update);
      window.removeEventListener('online', update);
      window.removeEventListener(API_MUTATION_EVENT, update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [enabled, identity]);
  return <ChatsContext.Provider value={enabled && result.identity === identity ? result.count : 0}>{children}</ChatsContext.Provider>;
}
export function useUnreadChatCount() {return useContext(ChatsContext);}
