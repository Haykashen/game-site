import type {
  AdminMarketEntryDto,
  AdminMarketModerationInput,
  AdminMarketQueueQuery,
  AdminReportsQuery,
  AdminUserDto,
  AdminUsersQuery,
  AdminUserStatusInput,
  MyReportsQuery,
  Paginated,
  ReportCreateInput,
  ReportDto,
  ReportUpdateInput,
  UserProfile,
} from '@discvault/shared';
import { apiRequest } from './client';

function querySuffix(
  params: Partial<MyReportsQuery | AdminReportsQuery>,
): string {
  const query = new URLSearchParams();

  if (params.status) query.set('status', params.status);
  if ('targetType' in params && params.targetType) {
    query.set('targetType', params.targetType);
  }
  if ('reason' in params && params.reason) query.set('reason', params.reason);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const suffix = query.toString();
  return suffix ? `?${suffix}` : '';
}

export function createReport(input: ReportCreateInput): Promise<ReportDto> {
  return apiRequest<ReportDto>('/api/v1/reports', {
    method: 'POST',
    body: input,
  });
}

export function listMyReports(
  params: Partial<MyReportsQuery> = {},
): Promise<Paginated<ReportDto>> {
  return apiRequest<Paginated<ReportDto>>(
    `/api/v1/reports/mine${querySuffix(params)}`,
  );
}

export function listAdminReports(
  params: Partial<AdminReportsQuery> = {},
): Promise<Paginated<ReportDto>> {
  return apiRequest<Paginated<ReportDto>>(
    `/api/v1/admin/reports${querySuffix(params)}`,
  );
}

export function updateAdminReport(
  id: string,
  input: ReportUpdateInput,
): Promise<ReportDto> {
  return apiRequest<ReportDto>(
    `/api/v1/admin/reports/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: input },
  );
}

export function listAdminMarketEntries(
  params: Partial<AdminMarketQueueQuery> = {},
): Promise<Paginated<AdminMarketEntryDto>> {
  const query = new URLSearchParams();

  if (params.status) query.set('status', params.status);
  if (params.kind) query.set('kind', params.kind);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const suffix = query.toString();
  return apiRequest<Paginated<AdminMarketEntryDto>>(
    `/api/v1/admin/market${suffix ? `?${suffix}` : ''}`,
  );
}

export function updateMarketModeration(
  id: string,
  input: AdminMarketModerationInput,
): Promise<AdminMarketEntryDto> {
  return apiRequest<AdminMarketEntryDto>(
    `/api/v1/admin/market/${encodeURIComponent(id)}/moderation`,
    { method: 'PATCH', body: input },
  );
}

export function listAdminUsers(
  params: Partial<AdminUsersQuery> = {},
  signal?: AbortSignal,
): Promise<Paginated<AdminUserDto>> {
  const query = new URLSearchParams();

  if (params.id) query.set('id', params.id);
  if (params.online && params.online !== 'all') query.set('online', params.online);
  if (params.lastSeenAt) query.set('lastSeenAt', params.lastSeenAt);

  if (params.search) query.set('search', params.search);
  if (params.role && params.role !== 'all') query.set('role', params.role);
  if (params.status && params.status !== 'all') {
    query.set('status', params.status);
  }
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortDir) query.set('sortDir', params.sortDir);
  if (params.comment) query.set('comment', params.comment);
  if (params.listings !== undefined) {
    query.set('listings', String(params.listings));
  }
  if (params.deals !== undefined) query.set('deals', String(params.deals));
  if (params.copies !== undefined) {
    query.set('copies', String(params.copies));
  }
  if (params.rating !== undefined) {
    query.set('rating', String(params.rating));
  }
  if (params.createdAt) query.set('createdAt', params.createdAt);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));

  const suffix = query.toString();
  return apiRequest<Paginated<AdminUserDto>>(
    `/api/v1/admin/users${suffix ? `?${suffix}` : ''}`,
    signal ? {signal} : {},
  );
}

export function updateUserStatus(
  id: string,
  input: AdminUserStatusInput,
): Promise<{ user: UserProfile }> {
  return apiRequest<{ user: UserProfile }>(
    `/api/v1/admin/users/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: input },
  );
}
