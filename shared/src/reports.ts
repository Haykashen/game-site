import { z } from 'zod';
import type { PublicUser } from './auth.js';
import type { MarketKind, MarketModerationStatus, MarketStatus } from './market.js';
import { idSchema, paginationSchema } from './common.js';

export const reportTargetTypeSchema = z.enum(['market_entry', 'user']);
export const reportReasonSchema = z.enum([
  'fraud',
  'prohibited',
  'offensive',
  'spam',
  'wrong_category',
  'other',
]);
export const reportStatusSchema = z.enum([
  'pending',
  'in_review',
  'resolved',
  'dismissed',
]);
export const reportActionSchema = z.enum(['none', 'hide_entry', 'suspend_user']);

export type ReportTargetType = z.infer<typeof reportTargetTypeSchema>;
export type ReportReason = z.infer<typeof reportReasonSchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export type ReportAction = z.infer<typeof reportActionSchema>;

export const reportCreateSchema = z.object({
  targetType: reportTargetTypeSchema,
  targetId: idSchema,
  reason: reportReasonSchema,
  comment: z.string().trim().max(2000, 'Комментарий слишком длинный.').default(''),
});

export const reportUpdateSchema = z
  .object({
    status: z.enum(['in_review', 'resolved', 'dismissed']),
    moderatorNote: z.string().trim().max(2000).nullable().optional(),
    action: reportActionSchema.default('none'),
  })
  .superRefine((value, ctx) => {
    if (value.action !== 'none' && value.status !== 'resolved') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['action'],
        message: 'Действие модерации доступно только при завершении жалобы.',
      });
    }
  });

export const myReportsQuerySchema = paginationSchema.extend({
  status: z
    .enum(['all', 'pending', 'in_review', 'resolved', 'dismissed'])
    .default('all'),
});

export const adminReportsQuerySchema = paginationSchema.extend({
  status: z
    .enum(['all', 'pending', 'in_review', 'resolved', 'dismissed'])
    .default('pending'),
  targetType: reportTargetTypeSchema.optional(),
  reason: reportReasonSchema.optional(),
});

export const adminMarketModerationSchema = z.object({
  moderationStatus: z.enum(['visible', 'hidden', 'removed']),
  note: z.string().trim().max(2000).nullable().optional(),
});

export const adminUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: z.string().trim().max(2000).nullable().optional(),
});

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ReportUpdateInput = z.infer<typeof reportUpdateSchema>;
export type MyReportsQuery = z.infer<typeof myReportsQuerySchema>;
export type AdminReportsQuery = z.infer<typeof adminReportsQuerySchema>;
export type AdminMarketModerationInput = z.infer<typeof adminMarketModerationSchema>;
export type AdminUserStatusInput = z.infer<typeof adminUserStatusSchema>;

export interface ReportMarketEntryTarget {
  id: string;
  title: string;
  kind: MarketKind;
  status: MarketStatus;
  moderationStatus: MarketModerationStatus;
  author: PublicUser;
}

export interface ReportDto {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  comment: string;
  status: ReportStatus;
  action: ReportAction;
  reporter: PublicUser;
  targetUser: PublicUser | null;
  marketEntry: ReportMarketEntryTarget | null;
  moderator: PublicUser | null;
  moderatorNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}
