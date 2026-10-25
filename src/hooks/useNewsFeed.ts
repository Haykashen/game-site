import { useCallback, useEffect, useState } from 'react';
import { errorMessage, listNews, mapNewsPost } from '../api';
import { useAuth } from '../context/AuthContext';
import { NEWS_POSTS } from '../data/news';
import type { NewsPost } from '../types';

export interface NewsFeedStore {
  posts: readonly NewsPost[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Editorial feed with the same API-first, demo-data fallback as the catalogue. */
export function useNewsFeed(): NewsFeedStore {
  const { status } = useAuth();
  const isApiMode = status === 'api';
  const [remotePosts, setRemotePosts] = useState<NewsPost[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isApiMode) {
      setRemotePosts(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);

    try {
      const page = await listNews({ pageSize: 100, sort: 'newest' });
      setRemotePosts(page.items.map(mapNewsPost));
      setError(null);
    } catch (requestError) {
      setRemotePosts(null);
      setError(errorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [isApiMode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    posts: isApiMode && remotePosts !== null ? remotePosts : NEWS_POSTS,
    isLoading,
    error,
    refresh,
  };
}
