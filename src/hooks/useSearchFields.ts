import { useCallback, useMemo } from 'react';
import type { CatalogFiltersDto } from '@discvault/shared';
import { fetchCatalogFilters } from '../api/catalog';
import { useApiResource } from './useApiResource';
import { CATALOG_FILTER_FIELDS, MARKET_FILTER_FIELDS } from '../lib/searchFilterConfig';

/** Release filters reflect actual editions from the database, including new platforms. */
export function useSearchFields(kind: 'catalog' | 'market') {
  const load = useCallback((signal: AbortSignal) => fetchCatalogFilters(signal), []);
  const options = useApiResource<CatalogFiltersDto | null>('catalog-filters', load, null);
  return useMemo(() => (kind === 'catalog' ? CATALOG_FILTER_FIELDS : MARKET_FILTER_FIELDS).map((field) => {
    const key = field.key;
    if (key !== 'platform' && key !== 'region' && key !== 'lang' && key !== 'edition') return field;
    const values = !options.data ? [] : key === 'platform' ? options.data.platforms.map((platform) => platform.name)
      : key === 'edition' ? options.data.editions : key === 'lang' ? options.data.languages : options.data.regions;
    return { ...field, options: [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru')).map((value) => ({ value, label: value })) };
  }), [options.data, kind]);
}
