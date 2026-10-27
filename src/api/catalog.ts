import type { CatalogFiltersDto, CatalogQuery, EditionDto, GameDetailDto, GameDto, GameWithStatsDto, Paginated } from '@discvault/shared';
import { apiRequest } from './client';

export const CATALOG_PAGE_SIZE = 24;
export type CatalogSearch = Pick<CatalogQuery, 'q' | 'platform' | 'lang' | 'region' | 'edition' | 'year'>;

/** Exactly one server-filtered page. This must never drain the whole catalogue. */
export function fetchCatalogPage(search: CatalogSearch, page: number, signal: AbortSignal): Promise<Paginated<GameWithStatsDto>> {
  const query = new URLSearchParams({page: String(page), pageSize: String(CATALOG_PAGE_SIZE)});
  for (const [key, value] of Object.entries(search)) if (value) query.set(key, value);
  return apiRequest(`/api/v1/catalog/games?${query}`, {signal});
}

export function fetchGameDetail(id: string, signal: AbortSignal): Promise<GameDetailDto> {
  return apiRequest(`/api/v1/catalog/games/${encodeURIComponent(id)}`, {signal});
}

export function fetchCatalogFilters(signal: AbortSignal): Promise<CatalogFiltersDto> {
  return apiRequest('/api/v1/catalog/filters', {signal});
}

/** Load every page, rather than silently truncating the catalogue at 100 rows. */
export async function collectPages<T>(load: (page: number) => Promise<Paginated<T>>): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const result = await load(page);
    if (result.page !== page || !Array.isArray(result.items) || typeof result.hasMore !== 'boolean' || (result.hasMore && result.items.length === 0)) {
      throw new Error('Сервер вернул некорректную страницу данных.');
    }
    items.push(...result.items);
    if (!result.hasMore) return items;
  }
}

export async function fetchCatalog(signal?: AbortSignal): Promise<{ games: GameDto[]; editions: EditionDto[] }> {
  const [games, editions] = await Promise.all([
    collectPages((page) => apiRequest<Paginated<GameWithStatsDto>>(
      '/api/v1/catalog/games?pageSize=100&page=' + page, { ...(signal ? { signal } : {}) })),
    collectPages((page) => apiRequest<Paginated<EditionDto>>(
      '/api/v1/catalog/editions?pageSize=100&page=' + page, { ...(signal ? { signal } : {}) })),
  ]);
  return { games, editions };
}
