import { z } from 'zod';
import { paginationSchema } from './common.js';
import {
  userRoleSchema,
  userStatusSchema,
  type UserRole,
  type UserStatus,
} from './auth.js';

export const adminUsersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  role: z.union([z.literal('all'), userRoleSchema]).default('all'),
  status: z.union([z.literal('all'), userStatusSchema]).default('all'),
});

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
  suspensionReason: string | null;
}
