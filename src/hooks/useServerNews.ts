import { useCallback } from 'react';
import type { NewsPostDto, Paginated } from '@discvault/shared';
import { apiRequest, mapNewsPost } from '../api';
import { collectPages } from '../api/catalog';
import type { NewsPost } from '../types';
import { useApiResource } from './useApiResource';
const EMPTY: NewsPost[] = [];
export function useNewsFeed() {
  const load = useCallback(async (signal: AbortSignal) => (await collectPages((page) =>
    apiRequest<Paginated<NewsPostDto>>('/api/v1/news?sort=newest&pageSize=100&page=' + page, { signal }))).map(mapNewsPost), []);
  const resource = useApiResource('news', load, EMPTY);
  return { posts: resource.data, isLoading: resource.isLoading, error: resource.error, refresh: resource.refresh };
}
