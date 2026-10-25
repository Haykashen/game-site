import type {
  DiscussionCommentCreateInput,
  DiscussionCommentUpdateInput,
  DiscussionCreateInput,
  DiscussionDetailDto,
  DiscussionReplyResponse,
  DiscussionSummaryDto,
  DiscussionUpdateInput,
  NewsCreateInput,
  NewsListQuery,
  NewsPostDto,
  NewsUpdateInput,
  Paginated,
} from '@discvault/shared';
import { apiRequest } from './client';

export interface DiscussionListParams {
  gameId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: 'recent' | 'newest' | 'oldest' | 'views';
}

function paginationQuery(params: {
  page?: number;
  pageSize?: number;
}): URLSearchParams {
  const query = new URLSearchParams();

  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  return query;
}

export function listDiscussions(
  params: DiscussionListParams = {},
): Promise<Paginated<DiscussionSummaryDto>> {
  const query = paginationQuery(params);

  if (params.gameId) query.set('gameId', params.gameId);
  if (params.q) query.set('q', params.q);
  if (params.sort) query.set('sort', params.sort);

  const suffix = query.toString();
  return apiRequest<Paginated<DiscussionSummaryDto>>(
    `/api/v1/discussions${suffix ? `?${suffix}` : ''}`,
  );
}

export function getDiscussion(id: string): Promise<DiscussionDetailDto> {
  return apiRequest<DiscussionDetailDto>(
    `/api/v1/discussions/${encodeURIComponent(id)}`,
  );
}

export function createDiscussion(
  input: DiscussionCreateInput,
): Promise<DiscussionSummaryDto> {
  return apiRequest<DiscussionSummaryDto>('/api/v1/discussions', {
    method: 'POST',
    body: input,
  });
}

export function updateDiscussion(
  id: string,
  input: DiscussionUpdateInput,
): Promise<DiscussionSummaryDto> {
  return apiRequest<DiscussionSummaryDto>(
    `/api/v1/discussions/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: input },
  );
}

export function deleteDiscussion(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/discussions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function replyToDiscussion(
  discussionId: string,
  input: DiscussionCommentCreateInput,
): Promise<DiscussionReplyResponse> {
  return apiRequest<DiscussionReplyResponse>(
    `/api/v1/discussions/${encodeURIComponent(discussionId)}/comments`,
    { method: 'POST', body: input },
  );
}

export function updateDiscussionComment(
  discussionId: string,
  commentId: string,
  input: DiscussionCommentUpdateInput,
): Promise<DiscussionReplyResponse['comment']> {
  return apiRequest<DiscussionReplyResponse['comment']>(
    `/api/v1/discussions/${encodeURIComponent(discussionId)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'PATCH', body: input },
  );
}

export function deleteDiscussionComment(
  discussionId: string,
  commentId: string,
): Promise<void> {
  return apiRequest<void>(
    `/api/v1/discussions/${encodeURIComponent(discussionId)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'DELETE' },
  );
}

export interface NewsListParams extends Partial<NewsListQuery> {
  page?: number;
  pageSize?: number;
}

export function listNews(
  params: NewsListParams = {},
): Promise<Paginated<NewsPostDto>> {
  const query = paginationQuery(params);

  if (params.category) query.set('category', params.category);
  if (params.gameId) query.set('gameId', params.gameId);
  if (params.q) query.set('q', params.q);
  if (params.sort) query.set('sort', params.sort);

  const suffix = query.toString();
  return apiRequest<Paginated<NewsPostDto>>(
    `/api/v1/news${suffix ? `?${suffix}` : ''}`,
  );
}

export function getNewsPost(id: string): Promise<NewsPostDto> {
  return apiRequest<NewsPostDto>(`/api/v1/news/${encodeURIComponent(id)}`);
}

export function createNewsPost(input: NewsCreateInput): Promise<NewsPostDto> {
  return apiRequest<NewsPostDto>('/api/v1/news', {
    method: 'POST',
    body: input,
  });
}

export function updateNewsPost(
  id: string,
  input: NewsUpdateInput,
): Promise<NewsPostDto> {
  return apiRequest<NewsPostDto>(
    `/api/v1/news/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: input },
  );
}

export function deleteNewsPost(id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/news/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
