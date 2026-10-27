import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import {
  errorMessage,
  fetchSubscriptions,
  fetchUnreadNotificationCount,
  subscribeGame,
  subscribeMarketEntry,
  unsubscribeGame,
  unsubscribeMarketEntry,
} from '../api';
import { useAuth } from './AuthContext';

interface NotificationsContextValue {
  unreadCount: number;
  gameSubscriptionIds: ReadonlySet<string>;
  entrySubscriptionIds: ReadonlySet<string>;
  isFollowingGame: (gameId: string) => boolean;
  isFollowingEntry: (entryId: string) => boolean;
  toggleGameSubscription: (gameId: string) => Promise<string | null>;
  toggleEntrySubscription: (entryId: string) => Promise<string | null>;
  refresh: () => Promise<void>;
  refreshUnread: () => Promise<void>;
  applyUnreadCount: (count: number) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const UNREAD_POLL_INTERVAL = 30_000;

/**
 * Keeps the unread badge and the user's game/lot subscriptions in one place, so
 * the top bar, sidebar and both detail drawers stay in sync.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const isRemote = status === 'api' && user !== null;
  const [unreadCount, setUnreadCount] = useState(0);
  const [gameSubscriptionIds, setGameSubscriptionIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [entrySubscriptionIds, setEntrySubscriptionIds] = useState<Set<string>>(
    () => new Set(),
  );

  const applyUnreadCount = useCallback((count: number) => {
    setUnreadCount(Math.max(0, count));
  }, []);

  const refreshUnread = useCallback(async () => {
    if (!isRemote) {
      setUnreadCount(0);
      return;
    }

    try {
      const response = await fetchUnreadNotificationCount();
      setUnreadCount(response.unreadCount);
    } catch {
      // The API can be temporarily unavailable; keep the last known badge.
    }
  }, [isRemote]);

  const refresh = useCallback(async () => {
    if (!isRemote) {
      setUnreadCount(0);
      setGameSubscriptionIds(new Set());
      setEntrySubscriptionIds(new Set());
      return;
    }

    try {
      const [countResponse, subscriptions] = await Promise.all([
        fetchUnreadNotificationCount(),
        fetchSubscriptions(),
      ]);
      setUnreadCount(countResponse.unreadCount);
      setGameSubscriptionIds(
        new Set(subscriptions.games.map((subscription) => subscription.gameId)),
      );
      setEntrySubscriptionIds(
        new Set(
          subscriptions.entries.map((subscription) => subscription.marketEntryId),
        ),
      );
    } catch {
      // Leave the previous state in place; the next poll will retry.
    }
  }, [isRemote]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isRemote) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshUnread();
    }, UNREAD_POLL_INTERVAL);

    return () => window.clearInterval(timer);
  }, [isRemote, refreshUnread]);

  const toggleGameSubscription = useCallback(
    async (gameId: string): Promise<string | null> => {
      if (!isRemote) return 'Войдите в аккаунт, чтобы следить за игрой.';

      const isFollowing = gameSubscriptionIds.has(gameId);

      try {
        if (isFollowing) {
          await unsubscribeGame(gameId);
        } else {
          await subscribeGame(gameId);
        }

        setGameSubscriptionIds((previous) => {
          const next = new Set(previous);
          if (isFollowing) next.delete(gameId);
          else next.add(gameId);
          return next;
        });
        return null;
      } catch (error) {
        return errorMessage(error);
      }
    },
    [gameSubscriptionIds, isRemote],
  );

  const toggleEntrySubscription = useCallback(
    async (entryId: string): Promise<string | null> => {
      if (!isRemote) return 'Войдите в аккаунт, чтобы следить за лотом.';

      const isFollowing = entrySubscriptionIds.has(entryId);

      try {
        if (isFollowing) {
          await unsubscribeMarketEntry(entryId);
        } else {
          await subscribeMarketEntry(entryId);
        }

        setEntrySubscriptionIds((previous) => {
          const next = new Set(previous);
          if (isFollowing) next.delete(entryId);
          else next.add(entryId);
          return next;
        });
        return null;
      } catch (error) {
        return errorMessage(error);
      }
    },
    [entrySubscriptionIds, isRemote],
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({
      unreadCount,
      gameSubscriptionIds,
      entrySubscriptionIds,
      isFollowingGame: (gameId) => gameSubscriptionIds.has(gameId),
      isFollowingEntry: (entryId) => entrySubscriptionIds.has(entryId),
      toggleGameSubscription,
      toggleEntrySubscription,
      refresh,
      refreshUnread,
      applyUnreadCount,
    }),
    [
      applyUnreadCount,
      entrySubscriptionIds,
      gameSubscriptionIds,
      refresh,
      refreshUnread,
      toggleEntrySubscription,
      toggleGameSubscription,
      unreadCount,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error('useNotifications must be used inside NotificationsProvider.');
  }

  return context;
}
