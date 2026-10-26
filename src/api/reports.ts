import type {
  AdminMarketEntryDto,
  AdminMarketModerationInput,
  AdminMarketQueueQuery,
  AdminReportsQuery,
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

export function updateUserStatus(
  id: string,
  input: AdminUserStatusInput,
): Promise<{ user: UserProfile }> {
  return apiRequest<{ user: UserProfile }>(
    `/api/v1/admin/users/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: input },
  );
}
