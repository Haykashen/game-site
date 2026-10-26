import type { AdminAnalyticsDto, AnalyticsPeriod } from '@discvault/shared';
import { apiRequest } from './client';

export function fetchAdminAnalytics(
  period: AnalyticsPeriod,
  signal?: AbortSignal,
): Promise<AdminAnalyticsDto> {
  const query = new URLSearchParams({ period });
  return apiRequest<AdminAnalyticsDto>(
    `/api/v1/admin/analytics?${query.toString()}`,
    signal ? { signal } : {},
  );
}
