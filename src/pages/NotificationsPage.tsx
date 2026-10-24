import {
  BadgeCheck,
  Bell,
  CircleX,
  Clock,
  EyeOff,
  Gavel,
  Handshake,
  RotateCcw,
  ShoppingBag,
  Tag,
  TrendingDown,
  Trophy,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { NotificationDto, NotificationType } from '@discvault/shared';
import {
  errorMessage,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api';
import { PageHeading } from '../components/PageHeading';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { cx } from '../lib/cx';
import { formatMarketDateTime } from '../lib/market';

const PAGE_SIZE = 20;

const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  bid_placed: Gavel,
  bid_outbid: TrendingDown,
  auction_won: Trophy,
  auction_lost: CircleX,
  auction_sold: BadgeCheck,
  auction_closed: Clock,
  entry_created: Bell,
  entry_sold: ShoppingBag,
  entry_closed: EyeOff,
  entry_reopened: RotateCcw,
  entry_price_changed: Tag,
  deal_created: Handshake,
};

type NotificationFilter = 'all' | 'unread';

/** Inbox for lot, listing and game notifications. */
export function NotificationsPage() {
  const { status, isAuthenticated } = useAuth();
  const { unreadCount, applyUnreadCount } = useNotifications();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [page, setPage] = useState(1);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  const isApiMode = status === 'api';

  const load = useCallback(async () => {
    if (!isApiMode || !isAuthenticated) {
      setNotifications([]);
      setTotal(0);
      setHasMore(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await listNotifications({
        status: filter,
        page,
        pageSize: PAGE_SIZE,
      });
      setNotifications(response.items);
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }, [filter, isApiMode, isAuthenticated, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNotification = async (notification: NotificationDto) => {
    let current = notification;

    if (!notification.readAt) {
      try {
        const response = await markNotificationRead(notification.id);
        current = response.notification;
        applyUnreadCount(response.unreadCount);
        setNotifications((previous) =>
          previous.map((item) =>
            item.id === response.notification.id ? response.notification : item,
          ),
        );
        if (filter === 'unread') {
          setNotifications((previous) =>
            previous.filter((item) => item.id !== response.notification.id),
          );
          setTotal((previous) => Math.max(0, previous - 1));
        }
      } catch (readError) {
        setError(errorMessage(readError));
        return;
      }
    }

    if (current.marketEntryId) {
      const section = current.marketEntryKind === 'auction' ? 'auctions' : 'listings';
      navigate(`/${section}?item=${encodeURIComponent(current.marketEntryId)}`);
      return;
    }

    if (current.gameId) {
      navigate(`/games?game=${encodeURIComponent(current.gameId)}`);
    }
  };

  const markAllRead = async () => {
    setIsMarkingAll(true);
    setError(null);

    try {
      const response = await markAllNotificationsRead();
      applyUnreadCount(response.unreadCount);
      const readAt = new Date().toISOString();
      setNotifications((previous) =>
        previous.map((notification) => ({
          ...notification,
          readAt: notification.readAt ?? readAt,
        })),
      );
      if (filter === 'unread') {
        setNotifications([]);
        setTotal(0);
        setHasMore(false);
      }
    } catch (markError) {
      setError(errorMessage(markError));
    } finally {
      setIsMarkingAll(false);
    }
  };

  const changeFilter = (nextFilter: NotificationFilter) => {
    setFilter(nextFilter);
    setPage(1);
  };

  return (
    <>
      <PageHeading
        eyebrow="ACCOUNT / NOTIFICATIONS"
        title="Уведомления"
        description="Ставки и закрытие лотов, новые объявления по играм, за которыми вы следите, и сделки."
        action={
          isAuthenticated && unreadCount > 0 ? (
            <button
              type="button"
              className="btn-secondary notifications__mark-all"
              onClick={() => void markAllRead()}
              disabled={isMarkingAll}
            >
              <BadgeCheck size={16} aria-hidden="true" />
              {isMarkingAll ? 'Отмечаем…' : 'Прочитать всё'}
            </button>
          ) : undefined
        }
      />

      {!isApiMode ? (
        <div className="notifications-state">
          <Bell size={28} aria-hidden="true" />
          <h2>Уведомления доступны в сетевом режиме</h2>
          <p>
            Автономная версия хранит данные в браузере и не отправляет события на
            сервер. Запустите приложение с API, чтобы получать уведомления.
          </p>
        </div>
      ) : !isAuthenticated ? (
        <div className="notifications-state">
          <Bell size={28} aria-hidden="true" />
          <h2>Войдите, чтобы получать уведомления</h2>
          <p>
            Подпишитесь на игру или лот, и мы сообщим о новых ставках, закрытии
            торгов и новых объявлениях.
          </p>
          <Link className="btn-secondary" to="/account">
            Войти в аккаунт
          </Link>
        </div>
      ) : (
        <>
          <div className="notifications-toolbar">
            <div className="notifications-tabs" role="group" aria-label="Фильтр уведомлений">
              <button
                type="button"
                className={cx('notifications-tab', filter === 'all' && 'active')}
                aria-pressed={filter === 'all'}
                onClick={() => changeFilter('all')}
              >
                Все
              </button>
              <button
                type="button"
                className={cx('notifications-tab', filter === 'unread' && 'active')}
                aria-pressed={filter === 'unread'}
                onClick={() => changeFilter('unread')}
              >
                Непрочитанные
                {unreadCount > 0 && (
                  <span className="notifications-tab__count">{unreadCount}</span>
                )}
              </button>
            </div>
            <span className="notifications-toolbar__count">
              {total > 0 ? `${total} всего` : 'Пока пусто'}
            </span>
          </div>

          {error && (
            <div className="market-sync-banner" role="alert">
              {error}
            </div>
          )}

          {isLoading && notifications.length === 0 ? (
            <div className="notifications-state notifications-state--loading">
              <p>Загружаем уведомления…</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notifications-state">
              <Bell size={28} aria-hidden="true" />
              <h2>{filter === 'unread' ? 'Непрочитанных нет' : 'Уведомлений пока нет'}</h2>
              <p>
                Откройте игру и нажмите «Следить за игрой» или откройте лот и
                подпишитесь на него.
              </p>
            </div>
          ) : (
            <ul className="notifications-list">
              {notifications.map((notification) => {
                const Icon = NOTIFICATION_ICONS[notification.type] ?? Bell;
                const isUnread = !notification.readAt;

                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      className={cx(
                        'notification-card',
                        isUnread && 'notification-card--unread',
                      )}
                      onClick={() => void openNotification(notification)}
                    >
                      <span className="notification-card__icon" aria-hidden="true">
                        <Icon size={18} />
                      </span>
                      <span className="notification-card__body">
                        <span className="notification-card__head">
                          <span className="notification-card__title">
                            {notification.title}
                          </span>
                          <time
                            className="notification-card__time"
                            dateTime={notification.createdAt}
                          >
                            {formatMarketDateTime(notification.createdAt)}
                          </time>
                        </span>
                        <span className="notification-card__message">
                          {notification.message}
                        </span>
                        {(notification.marketEntryTitle || notification.gameTitle) && (
                          <span className="notification-card__context">
                            {notification.marketEntryTitle
                              ? `Лот: ${notification.marketEntryTitle}`
                              : `Игра: ${notification.gameTitle}`}
                          </span>
                        )}
                      </span>
                      {isUnread && (
                        <>
                          <span
                            className="notification-card__dot"
                            aria-hidden="true"
                          />
                          <span className="sr-only">Непрочитанное</span>
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {(page > 1 || hasMore) && (
            <div className="notifications-pagination">
              <button
                type="button"
                className="btn-secondary"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              >
                Назад
              </button>
              <span>Страница {page}</span>
              <button
                type="button"
                className="btn-secondary"
                disabled={!hasMore || isLoading}
                onClick={() => setPage((previous) => previous + 1)}
              >
                Дальше
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
