import type { Paginated, PublicProfile, ReviewDto } from '@discvault/shared';
import { apiRequest } from './client';

export interface ReviewListParams {
  page?: number;
  pageSize?: number;
}

export function fetchPublicProfile(id: string): Promise<PublicProfile> {
  return apiRequest<PublicProfile>(`/api/v1/users/${encodeURIComponent(id)}`);
}

export function listUserReviews(
  id: string,
  params: ReviewListParams = {},
): Promise<Paginated<ReviewDto>> {
  const query = new URLSearchParams();

  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const suffix = query.toString();
  return apiRequest<Paginated<ReviewDto>>(
    `/api/v1/users/${encodeURIComponent(id)}/reviews${suffix ? `?${suffix}` : ''}`,
  );
}
