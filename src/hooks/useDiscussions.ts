import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiscussionCommentCreateInput } from '@discvault/shared';
import {
  errorMessage,
  getDiscussion,
  listDiscussions,
  mapDiscussionDetail,
  mapDiscussionSummary,
  replyToDiscussion,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { DISCUSSIONS } from '../data/discussions';
import { usePersistentState } from './usePersistentState';
import { STORAGE_KEYS } from '../lib/constants';
import { countDiscussionReplies } from '../lib/discussions';
import { createId } from '../lib/storage';
import type { Discussion, DiscussionComment } from '../types';

type LocalReplyMap = Record<string, DiscussionComment[]>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function readLocalReply(value: unknown): DiscussionComment | null {
  if (!isRecord(value)) return null;

  const { id, author, body, createdAt } = value;

  if (
    typeof id !== 'string' ||
    typeof author !== 'string' ||
    typeof body !== 'string' ||
    typeof createdAt !== 'string' ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }

  const authorId = typeof value.authorId === 'string' ? value.authorId : undefined;
  const parentId =
    typeof value.parentId === 'string'
      ? value.parentId
      : value.parentId === null
        ? null
        : undefined;

  return {
    id,
    author,
    body,
    createdAt,
    ...(authorId ? { authorId } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
  };
}

function parseLocalReplies(value: unknown): LocalReplyMap | null {
  if (!isRecord(value)) return null;

  const parsed: LocalReplyMap = {};

  for (const [discussionId, replies] of Object.entries(value)) {
    if (!Array.isArray(replies)) continue;

    parsed[discussionId] = replies
      .map(readLocalReply)
      .filter((reply): reply is DiscussionComment => reply !== null);
  }

  return parsed;
}

function mergeDiscussion(
  summary: Discussion,
  previous: Discussion | undefined,
): Discussion {
  if (!previous || previous.comments.length === 0) return summary;

  const commentCount = summary.commentCount ?? previous.commentCount;

  return {
    ...summary,
    comments: previous.comments,
    ...(commentCount !== undefined ? { commentCount } : {}),
  };
}

export interface DiscussionsStore {
  discussions: readonly Discussion[];
  isLoading: boolean;
  isDetailLoading: boolean;
  error: string | null;
  detailError: string | null;
  refresh: () => Promise<void>;
  loadDiscussion: (discussionId: string) => Promise<void>;
  /** Returns a user-facing error, or null when the reply was saved. */
  reply: (
    discussionId: string,
    body: string,
    parentId?: string | null,
  ) => Promise<string | null>;
}

/**
 * Community feed backed by the API and the seeded demo topics. When the API is
 * unavailable the page stays fully usable and replies are kept in localStorage.
 */
export function useDiscussions(): DiscussionsStore {
  const { status, user } = useAuth();
  const isApiMode = status === 'api';
  const [remoteDiscussions, setRemoteDiscussions] = useState<Discussion[] | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [localReplies, setLocalReplies] = usePersistentState<LocalReplyMap>(
    STORAGE_KEYS.discussionReplies,
    {},
    parseLocalReplies,
  );

  const refresh = useCallback(async () => {
    if (!isApiMode) {
      setRemoteDiscussions(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);

    try {
      const page = await listDiscussions({ pageSize: 100, sort: 'recent' });
      setRemoteDiscussions((previous) => {
        const byId = new Map(
          (previous ?? []).map((discussion) => [discussion.id, discussion]),
        );

        return page.items.map((dto) =>
          mergeDiscussion(
            mapDiscussionSummary(dto),
            byId.get(dto.id),
          ),
        );
      });
      setError(null);
    } catch (requestError) {
      setRemoteDiscussions(null);
      setError(errorMessage(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [isApiMode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadDiscussion = useCallback(
    async (discussionId: string) => {
      if (!isApiMode) return;

      setDetailLoadingId(discussionId);
      setDetailError(null);

      try {
        const dto = await getDiscussion(discussionId);
        const detail = mapDiscussionDetail(dto);
        setRemoteDiscussions((previous) => {
          const list = previous ?? [];
          const exists = list.some((discussion) => discussion.id === detail.id);

          if (!exists) return [detail, ...list];

          return list.map((discussion) =>
            discussion.id === detail.id ? detail : discussion,
          );
        });
      } catch (requestError) {
        setDetailError(errorMessage(requestError));
      } finally {
        setDetailLoadingId((current) =>
          current === discussionId ? null : current,
        );
      }
    },
    [isApiMode],
  );

  const demoDiscussions = useMemo(
    () =>
      DISCUSSIONS.map((discussion) => {
        const extraReplies = localReplies[discussion.id] ?? [];
        const comments = [...discussion.comments, ...extraReplies];
        const lastReply = extraReplies[extraReplies.length - 1];

        return {
          ...discussion,
          comments,
          commentCount: countDiscussionReplies(comments),
          updatedAt: lastReply
            ? new Date(
                Math.max(
                  Date.parse(discussion.updatedAt),
                  Date.parse(lastReply.createdAt),
                ),
              ).toISOString()
            : discussion.updatedAt,
        };
      }),
    [localReplies],
  );

  const discussions =
    isApiMode && remoteDiscussions !== null
      ? remoteDiscussions
      : demoDiscussions;

  const reply = useCallback(
    async (
      discussionId: string,
      body: string,
      parentId: string | null = null,
    ): Promise<string | null> => {
      if (!isApiMode) {
        const localReply: DiscussionComment = {
          id: createId(),
          author: 'Вы',
          body: body.trim(),
          parentId,
          createdAt: new Date().toISOString(),
        };

        setLocalReplies((current) => ({
          ...current,
          [discussionId]: [...(current[discussionId] ?? []), localReply],
        }));

        return null;
      }

      if (!user) {
        return 'Войдите, чтобы ответить в обсуждении.';
      }

      try {
        const input: DiscussionCommentCreateInput = {
          body,
          ...(parentId ? { parentId } : {}),
        };

        await replyToDiscussion(discussionId, input);
        await loadDiscussion(discussionId);
        return null;
      } catch (requestError) {
        return errorMessage(requestError);
      }
    },
    [isApiMode, loadDiscussion, setLocalReplies, user],
  );

  return {
    discussions,
    isLoading,
    isDetailLoading: detailLoadingId !== null,
    error,
    detailError,
    refresh,
    loadDiscussion,
    reply,
  };
}
