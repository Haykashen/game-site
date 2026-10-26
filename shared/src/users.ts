import { z } from 'zod';
import { dateOnlySchema, paginationSchema } from './common.js';
import {
  userRoleSchema,
  userStatusSchema,
  type UserRole,
  type UserStatus,
} from './auth.js';

export const adminUserSortFieldSchema = z.enum([
  'user',
  'role',
  'status',
  'comment',
  'listings',
  'deals',
  'copies',
  'rating',
  'createdAt',
]);

export const adminUserSortDirSchema = z.enum(['asc', 'desc']);

export const adminUsersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  role: z.union([z.literal('all'), userRoleSchema]).default('all'),
  status: z.union([z.literal('all'), userStatusSchema]).default('all'),
  sortBy: adminUserSortFieldSchema.default('createdAt'),
  sortDir: adminUserSortDirSchema.default('desc'),
  comment: z.string().trim().max(2000).optional(),
  listings: z.coerce.number().int().min(0).optional(),
  deals: z.coerce.number().int().min(0).optional(),
  copies: z.coerce.number().int().min(0).optional(),
  rating: z.coerce.number().min(0).max(5).optional(),
  createdAt: dateOnlySchema.optional(),
});

export type AdminUserSortField = z.infer<typeof adminUserSortFieldSchema>;
export type AdminUserSortDir = z.infer<typeof adminUserSortDirSchema>;
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export interface AdminUserDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isDemo: boolean;
  role: UserRole;
  status: UserStatus;
  rating: number | null;
  reviewCount: number;
  listings: number;
  deals: number;
  copies: number;
  createdAt: string;
  suspendedAt: string | null;
  comment: string | null;
}
