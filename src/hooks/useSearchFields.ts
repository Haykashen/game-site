import { apiRequest } from '../api/client';
import { useCallback, useMemo } from 'react';
import { useStatusFilter } from './useStatusFilter';
import type { CatalogFiltersDto } from '@discvault/shared';
import { fetchCatalogFilters } from '../api/catalog';
import { useApiResource } from './useApiResource';
import { CATALOG_FILTER_FIELDS, MARKET_FILTER_FIELDS } from '../lib/searchFilterConfig';

/** Release filters reflect actual editions from the database, including new platforms. */
export function useSearchFields(kind: 'catalog' | 'market', entity = kind === 'catalog' ? 'Game' : 'Listing') {
  const statusField = useStatusFilter(entity);
  const load = useCallback((signal: AbortSignal) => fetchCatalogFilters(signal), []);
  const options = useApiResource<CatalogFiltersDto | null>('catalog-filters', load, null);
  const loadLocalizations = useCallback((signal: AbortSignal) => kind === 'market'
    ? apiRequest<{items: {id: string; name: string}[]}>('/api/v1/market/localizations', {signal})
    : Promise.resolve({items: []}), [kind]);
  const localizations = useApiResource('filter-localizations:' + kind, loadLocalizations, null);
  return useMemo(() => [...(kind === 'catalog' ? CATALOG_FILTER_FIELDS : MARKET_FILTER_FIELDS), statusField].map((field) => {
    const key = field.key;
    if (key === 'localizationId') return {...field, options: (localizations.data?.items ?? []).map(item => ({value: item.id, label: item.name}))};
    if (key !== 'platform' && key !== 'region' && key !== 'edition' && key !== 'genre') return field;
    const values = !options.data ? [] : key === 'platform' ? options.data.platforms.map((platform) => platform.name)
      : key === 'genre' ? options.data.genres ?? [] : key === 'edition' ? options.data.editions : options.data.regions;
    return { ...field, options: [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru')).map((value) => ({ value, label: value })) };
  }), [options.data, localizations.data, kind, statusField]);
}
