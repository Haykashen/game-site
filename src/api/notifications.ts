import type {
  GameSubscriptionDto,
  GameSubscriptionUpdate,
  MarketEntrySubscriptionDto,
  NotificationDto,
  NotificationReadAllResponse,
  NotificationReadResponse,
  Paginated,
  SubscriptionListDto,
} from '@retrokeep/shared';
import { apiRequest } from './client';

export interface NotificationListParams {
  status?: 'all' | 'unread';
  page?: number;
  pageSize?: number;
}

export function listNotifications(
  params: NotificationListParams = {},
): Promise<Paginated<NotificationDto>> {
  const query = new URLSearchParams();

  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const suffix = query.toString();
  return apiRequest<Paginated<NotificationDto>>(
    `/api/v1/notifications${suffix ? `?${suffix}` : ''}`,
  );
}

export function fetchUnreadNotificationCount(): Promise<{ unreadCount: number }> {
  return apiRequest<{ unreadCount: number }>('/api/v1/notifications/unread-count');
}

export function markNotificationRead(id: string): Promise<NotificationReadResponse> {
  return apiRequest<NotificationReadResponse>(
    `/api/v1/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' },
  );
}

export function markAllNotificationsRead(): Promise<NotificationReadAllResponse> {
  return apiRequest<NotificationReadAllResponse>('/api/v1/notifications/read-all', {
    method: 'PATCH',
  });
}

export function fetchSubscriptions(): Promise<SubscriptionListDto> {
  return apiRequest<SubscriptionListDto>('/api/v1/subscriptions');
}

export function subscribeGame(
  gameId: string,
  input?: GameSubscriptionUpdate,
): Promise<GameSubscriptionDto> {
  return apiRequest<GameSubscriptionDto>(
    `/api/v1/subscriptions/games/${encodeURIComponent(gameId)}`,
    { method: 'PUT', ...(input ? { body: input } : {}) },
  );
}

export function unsubscribeGame(gameId: string): Promise<void> {
  return apiRequest<void>(
    `/api/v1/subscriptions/games/${encodeURIComponent(gameId)}`,
    { method: 'DELETE' },
  );
}

export function subscribeMarketEntry(
  entryId: string,
): Promise<MarketEntrySubscriptionDto> {
  return apiRequest<MarketEntrySubscriptionDto>(
    `/api/v1/subscriptions/market/${encodeURIComponent(entryId)}`,
    { method: 'PUT' },
  );
}

export function unsubscribeMarketEntry(entryId: string): Promise<void> {
  return apiRequest<void>(
    `/api/v1/subscriptions/market/${encodeURIComponent(entryId)}`,
    { method: 'DELETE' },
  );
}
