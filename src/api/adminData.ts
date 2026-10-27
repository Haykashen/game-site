import type { AdminDataQuery, AdminRecord, AdminReference, AdminTable, Paginated } from '@discvault/shared';
import { apiRequest } from './client';

const base = '/api/v1/admin/data';
const tablePath = (table: string) => `${base}/${encodeURIComponent(table)}`;
const recordPath = (table: string, key: string) => `${tablePath(table)}/records/${encodeURIComponent(key)}`;
export function fetchAdminTables(signal?: AbortSignal) {
  return apiRequest<{tables: AdminTable[]}>(base, signal ? {signal} : {});
}
export function fetchAdminRecords(table: string, query: AdminDataQuery, signal?: AbortSignal) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, key === 'filters' ? JSON.stringify(value) : String(value));
  }
  return apiRequest<Paginated<AdminRecord>>(`${tablePath(table)}/records?${params}`, signal ? {signal} : {});
}
export function fetchAdminRecord(table: string, key: string, signal?: AbortSignal) {
  return apiRequest<{record: AdminRecord}>(recordPath(table, key), signal ? {signal} : {});
}
export function fetchAdminReferences(table: string, search: string, signal: AbortSignal) {
  return apiRequest<{items: AdminReference[]}>(`${tablePath(table)}/references?search=${encodeURIComponent(search)}`, {signal});
}
export function createAdminRecord(table: string, data: AdminRecord) {
  return apiRequest<{record: AdminRecord}>(`${tablePath(table)}/records`, {method: 'POST', body: data});
}
export function updateAdminRecord(table: string, key: string, data: AdminRecord, expectedUpdatedAt: string | null) {
  return apiRequest<{record: AdminRecord}>(recordPath(table, key), {method: 'PATCH', body: {data, expectedUpdatedAt}});
}
export function deleteAdminRecord(table: string, key: string, expectedUpdatedAt: string | null) {
  return apiRequest<void>(recordPath(table, key), {method: 'DELETE', body: {expectedUpdatedAt}});
}
