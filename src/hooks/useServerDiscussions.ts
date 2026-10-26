import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiscussionSummaryDto, Paginated } from '@discvault/shared';
import { apiRequest, errorMessage, getDiscussion, mapDiscussionDetail, mapDiscussionSummary, replyToDiscussion } from '../api';
import { collectPages } from '../api/catalog';
import { useAuth } from '../context/AuthContext';
import type { Discussion } from '../types';
import { useApiResource } from './useApiResource';
const EMPTY: Discussion[] = [];
export function useDiscussions() {
  const { user, status } = useAuth();
  const identity = (user?.id ?? 'guest') + ':' + status;
  const current = useRef(identity);
  current.current = identity;
  const detailRequest = useRef(0);
  const [details, setDetails] = useState<{ key: string; items: Discussion[] }>({ key: identity, items: [] });
  const [detailState, setDetailState] = useState({ key: identity, loading: false, error: null as string | null });
  const load = useCallback(async (signal: AbortSignal) => (await collectPages((page) =>
    apiRequest<Paginated<DiscussionSummaryDto>>('/api/v1/discussions?sort=recent&pageSize=100&page=' + page, { signal }))).map(mapDiscussionSummary), []);
  const resource = useApiResource('discussions', load, EMPTY);
  useEffect(() => () => { detailRequest.current += 1; }, [identity]);
  const discussions = useMemo(() => {
    const byId = new Map(resource.data.map((topic) => [topic.id, topic]));
    if (details.key === identity) for (const topic of details.items) byId.set(topic.id, topic);
    return [...byId.values()];
  }, [details, identity, resource.data]);
  const loadDiscussion = useCallback(async (id: string) => {
    if (status !== 'api') return;
    const request = ++detailRequest.current;
    setDetailState({ key: identity, loading: true, error: null });
    try {
      const topic = mapDiscussionDetail(await getDiscussion(id));
      if (current.current !== identity || request !== detailRequest.current) return;
      setDetails((previous) => ({ key: identity, items: [topic, ...(previous.key === identity ? previous.items : []).filter((item) => item.id !== id)] }));
      setDetailState({ key: identity, loading: false, error: null });
    } catch (cause) {
      if (current.current === identity && request === detailRequest.current) setDetailState({ key: identity, loading: false, error: errorMessage(cause) });
    }
  }, [identity, status]);
  const reply = useCallback(async (id: string, body: string, parentId?: string | null) => {
    if (!user || status !== 'api') return 'Войдите, чтобы ответить в обсуждении.';
    try {
      await replyToDiscussion(id, { body, ...(parentId ? { parentId } : {}) });
      if (current.current === identity) await loadDiscussion(id);
      return null;
    } catch (cause) { return errorMessage(cause); }
  }, [identity, loadDiscussion, status, user]);
  return {
    discussions, reply, loadDiscussion, refresh: resource.refresh,
    isLoading: resource.isLoading, error: resource.error,
    isDetailLoading: detailState.key === identity && detailState.loading,
    detailError: detailState.key === identity ? detailState.error : null,
  };
}
