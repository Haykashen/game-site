import type {
  DealDto,
  DealStatus,
  Paginated,
  ReviewCreateInput,
  ReviewDto,
} from '@discvault/shared';
import { apiRequest } from './client';

export interface DealListParams {
  role?: 'all' | 'buyer' | 'seller';
  status?: 'all' | DealStatus;
  page?: number;
  pageSize?: number;
}

export function listDeals(
  params: DealListParams = {},
): Promise<Paginated<DealDto>> {
  const query = new URLSearchParams();

  if (params.role) query.set('role', params.role);
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const suffix = query.toString();
  return apiRequest<Paginated<DealDto>>(
    `/api/v1/deals${suffix ? `?${suffix}` : ''}`,
  );
}

export function updateDealStatus(
  id: string,
  status: 'completed' | 'cancelled',
): Promise<DealDto> {
  return apiRequest<DealDto>(`/api/v1/deals/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function createReview(
  dealId: string,
  input: ReviewCreateInput,
): Promise<ReviewDto> {
  return apiRequest<ReviewDto>(
    `/api/v1/deals/${encodeURIComponent(dealId)}/reviews`,
    { method: 'POST', body: input },
  );
}
