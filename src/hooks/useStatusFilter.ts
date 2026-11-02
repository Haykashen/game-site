import { useCallback } from 'react';
import { apiRequest } from '../api/client';
import { useApiResource } from './useApiResource';
import type { SearchFilterField } from '../lib/searchFilterConfig';

type StatusOption = {id: string; name: string};
const EMPTY: StatusOption[] = [];
export function useStatusFilter(entity: string): SearchFilterField<'statusId'> {
  const load = useCallback(async (signal: AbortSignal) => (await apiRequest<{items: StatusOption[]}>(`/api/v1/statuses?entity=${encodeURIComponent(entity)}`, {signal})).items, [entity]);
  const resource = useApiResource('status-options:' + entity, load, EMPTY);
  return {id: entity + 'StatusFilter', key: 'statusId', label: 'Статус', placeholder: 'Все статусы', options: resource.data.map(item => ({value: item.id, label: item.name}))};
}
