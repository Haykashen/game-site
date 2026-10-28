import { useCallback } from 'react';
import type { AdminTable } from '@discvault/shared';
import { fetchAdminTables } from '../api/adminData';
import { useAuth } from '../context/AuthContext';
import { useApiResource } from './useApiResource';
const EMPTY: AdminTable[] = [];
export function useAdminTables() {
  const {user, isModerator} = useAuth();
  const load = useCallback(async (signal: AbortSignal) => isModerator ? (await fetchAdminTables(signal)).tables : EMPTY, [isModerator]);
  return useApiResource('admin-tables:' + (user?.id ?? 'guest'), load, EMPTY);
}
