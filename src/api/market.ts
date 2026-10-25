import type {
  BidCreateInput,
  DealDto,
  MarketCreateInput,
  MarketEntryDto,
  MarketStatusUpdate,
  MarketUpdateInput,
  Paginated,
  PlaceBidResponse,
} from '@discvault/shared';
import { apiRequest } from './client';

export interface MarketListParams {
  status?: 'active' | 'sold' | 'closed' | 'all';
  kind?: 'listing' | 'auction';
  page?: number;
  pageSize?: number;
  sort?: 'newest' | 'oldest' | 'endingSoon' | 'priceAsc' | 'priceDesc';
  /** `me` requests the current user's lots, including ones hidden by moderation. */
  authorId?: string;
  itemType?: import('@discvault/shared').MarketItemType;
}

export function listMarketEntries(
  params: MarketListParams = {},
): Promise<Paginated<MarketEntryDto>> {
  const query = new URLSearchParams();

  if (params.status) query.set('status', params.status);
  if (params.kind) query.set('kind', params.kind);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.sort) query.set('sort', params.sort);
  if (params.authorId) query.set('authorId', params.authorId);
  if (params.itemType) query.set('itemType', params.itemType);

  const suffix = query.toString();
  return apiRequest<Paginated<MarketEntryDto>>(
    `/api/v1/market${suffix ? `?${suffix}` : ''}`,
  );
}

export function createMarketEntry(
  input: MarketCreateInput,
): Promise<MarketEntryDto> {
  return apiRequest<MarketEntryDto>('/api/v1/market', {
    method: 'POST',
    body: input,
  });
}

export function updateMarketEntry(
  id: string,
  input: MarketUpdateInput,
): Promise<MarketEntryDto> {
  return apiRequest<MarketEntryDto>(`/api/v1/market/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: input,
  });
}

export function updateMarketStatus(
  id: string,
  input: MarketStatusUpdate,
): Promise<MarketEntryDto> {
  return apiRequest<MarketEntryDto>(
    `/api/v1/market/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: input },
  );
}

export function deleteMarketEntry(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/market/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function placeBidRequest(
  id: string,
  input: BidCreateInput,
): Promise<PlaceBidResponse> {
  return apiRequest<PlaceBidResponse>(
    `/api/v1/market/${encodeURIComponent(id)}/bids`,
    { method: 'POST', body: input },
  );
}

export function createDealRequest(id: string): Promise<DealDto> {
  return apiRequest<DealDto>(
    `/api/v1/market/${encodeURIComponent(id)}/deals`,
    { method: 'POST' },
  );
}
