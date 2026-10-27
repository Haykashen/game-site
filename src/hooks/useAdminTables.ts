import { useCallback } from 'react';
import type { AdminTable } from '@discvault/shared';
import { fetchAdminTables } from '../api/adminData';
import { useAuth } from '../context/AuthContext';
import { useApiResource } from './useApiResource';
const EMPTY: AdminTable[] = [];
export function useAdminTables() {
  const {user, isAdmin} = useAuth();
  const load = useCallback(async (signal: AbortSignal) => isAdmin ? (await fetchAdminTables(signal)).tables : EMPTY, [isAdmin]);
  return useApiResource('admin-tables:' + (user?.id ?? 'guest'), load, EMPTY);
}
