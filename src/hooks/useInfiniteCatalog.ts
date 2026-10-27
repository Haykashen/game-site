import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { fetchCatalogPage, type CatalogSearch } from '../api/catalog';
import { useAuth } from '../context/AuthContext';
import { CatalogPager } from '../lib/catalogPager';
import type { CatalogFilters } from '../types';
import { useDebouncedValue } from './useDebouncedValue';

export function useInfiniteCatalog(filters: CatalogFilters) {
  const {status, user} = useAuth();
  const query = JSON.stringify({q: filters.query.trim(), platform: filters.platform, lang: filters.lang, region: filters.region, edition: filters.edition, year: filters.yearRange});
  const debounced = useDebouncedValue(query);
  const pager = useMemo(() => {
    const search = JSON.parse(debounced) as CatalogSearch;
    return new CatalogPager((page, signal) => fetchCatalogPage(search, page, signal));
    // Account changes must reset server-provided ownership counts as well.
  }, [debounced, user?.id, status]);
  const state = useSyncExternalStore(pager.subscribe, pager.getSnapshot, pager.getSnapshot);
  useEffect(() => {
    if (status === 'api') void pager.loadNext();
    return () => pager.dispose();
  }, [pager, status]);
  return {
    ...state,
    loading: status === 'checking' || (status === 'api' && state.page === 0 && !state.error) || state.loading,
    error: status === 'offline' ? 'Сервер недоступен. Повторите загрузку после восстановления соединения.' : state.error,
    loadMore: pager.loadNext,
    canLoad: status === 'api' && query === debounced,
  };
}
