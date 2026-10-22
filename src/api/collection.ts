import type {
  CopyDetailsInput,
  CopyDto,
  CollectionStatsDto,
} from '@retrokeep/shared';
import { apiRequest } from './client';

export function listCopies(): Promise<CopyDto[]> {
  return apiRequest<CopyDto[]>('/api/v1/collection/copies');
}

export function createCopyRequest(editionId: string): Promise<CopyDto> {
  return apiRequest<CopyDto>('/api/v1/collection/copies', {
    method: 'POST',
    body: { editionId },
  });
}

export function updateCopyEditionRequest(
  editionId: string,
  details: CopyDetailsInput,
): Promise<CopyDto[]> {
  return apiRequest<CopyDto[]>(
    `/api/v1/collection/editions/${encodeURIComponent(editionId)}`,
    { method: 'PATCH', body: details },
  );
}

export function setEditionQuantityRequest(
  editionId: string,
  quantity: number,
): Promise<CopyDto[]> {
  return apiRequest<CopyDto[]>(
    `/api/v1/collection/editions/${encodeURIComponent(editionId)}/quantity`,
    { method: 'PUT', body: { quantity } },
  );
}

export function deleteEditionRequest(editionId: string): Promise<void> {
  return apiRequest<void>(
    `/api/v1/collection/editions/${encodeURIComponent(editionId)}`,
    { method: 'DELETE' },
  );
}

export function fetchCollectionStats(): Promise<CollectionStatsDto> {
  return apiRequest<CollectionStatsDto>('/api/v1/collection/stats');
}
