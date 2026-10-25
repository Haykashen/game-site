import { z } from 'zod';
import type { PublicUser } from './auth.js';
import { idSchema, isoDateTimeSchema, paginationSchema } from './common.js';

export const newsCategorySchema = z.enum(['release', 'guide', 'community', 'update']);
export const discussionSortSchema = z.enum(['recent', 'newest', 'oldest', 'views']);
export const newsSortSchema = z.enum(['newest', 'oldest']);

export type NewsCategory = z.infer<typeof newsCategorySchema>;
export type DiscussionSort = z.infer<typeof discussionSortSchema>;
export type NewsSort = z.infer<typeof newsSortSchema>;

const tagsSchema = z
  .array(z.string().trim().min(1, 'Тег не может быть пустым.').max(30))
  .max(8, 'Можно добавить не больше 8 тегов.')
  .default([]);

export const discussionListQuerySchema = paginationSchema.extend({
  gameId: idSchema.optional(),
  q: z.string().trim().max(120).optional(),
  sort: discussionSortSchema.default('recent'),
});

export const discussionCreateSchema = z.object({
  gameId: idSchema,
  title: z
    .string()
    .trim()
    .min(3, 'Заголовок должен содержать минимум 3 символа.')
    .max(160, 'Заголовок слишком длинный.'),
  excerpt: z.string().trim().max(300, 'Краткое описание слишком длинное.').optional(),
  body: z
    .string()
    .trim()
    .min(10, 'Добавьте текст темы.')
    .max(20_000, 'Текст темы слишком длинный.'),
  tags: tagsSchema,
});

export const discussionUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    excerpt: z.string().trim().max(300).optional(),
    body: z.string().trim().min(10).max(20_000).optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Нет изменений для сохранения.');

export const discussionCommentCreateSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Напишите ответ.')
    .max(4_000, 'Ответ слишком длинный.'),
  parentId: idSchema.nullable().optional(),
});

export const discussionCommentUpdateSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Напишите ответ.')
    .max(4_000, 'Ответ слишком длинный.'),
});

export const newsListQuerySchema = paginationSchema.extend({
  category: newsCategorySchema.optional(),
  gameId: idSchema.optional(),
  q: z.string().trim().max(120).optional(),
  sort: newsSortSchema.default('newest'),
});

export const newsCreateSchema = z.object({
  title: z.string().trim().min(3, 'Заголовок слишком короткий.').max(180),
  excerpt: z.string().trim().max(320).optional(),
  body: z.string().trim().min(10, 'Добавьте текст новости.').max(30_000),
  category: newsCategorySchema,
  gameId: idSchema.nullable().optional(),
  tags: tagsSchema,
  publishedAt: isoDateTimeSchema.optional(),
});

export const newsUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(180).optional(),
    excerpt: z.string().trim().max(320).optional(),
    body: z.string().trim().min(10).max(30_000).optional(),
    category: newsCategorySchema.optional(),
    gameId: idSchema.nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(30)).max(8).optional(),
    publishedAt: isoDateTimeSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Нет изменений для сохранения.');

export interface DiscussionSummaryDto {
  id: string;
  gameId: string;
  title: string;
  excerpt: string;
  body: string;
  authorId: string;
  author: PublicUser;
  createdAt: string;
  updatedAt: string;
  views: number;
  tags: string[];
  pinned: boolean;
  /** Number of replies at every nesting level. */
  commentCount: number;
}

export interface DiscussionCommentDto {
  id: string;
  discussionId: string;
  /** Parent comment for a threaded reply; `null` for a root-level reply. */
  parentId: string | null;
  author: PublicUser;
  body: string;
  createdAt: string;
  updatedAt: string;
  replies: DiscussionCommentDto[];
}

export interface DiscussionDetailDto extends DiscussionSummaryDto {
  /** Root-level comments. Each comment carries its own nested `replies`. */
  comments: DiscussionCommentDto[];
}

export interface DiscussionReplyResponse {
  comment: DiscussionCommentDto;
  commentCount: number;
  /** New thread activity timestamp, used to reorder the feed after a reply. */
  updatedAt: string;
}

export interface NewsPostDto {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  category: NewsCategory;
  authorId: string;
  author: PublicUser;
  publishedAt: string;
  gameId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type DiscussionListQuery = z.infer<typeof discussionListQuerySchema>;
export type DiscussionCreateInput = z.infer<typeof discussionCreateSchema>;
export type DiscussionUpdateInput = z.infer<typeof discussionUpdateSchema>;
export type DiscussionCommentCreateInput = z.infer<typeof discussionCommentCreateSchema>;
export type DiscussionCommentUpdateInput = z.infer<typeof discussionCommentUpdateSchema>;
export type NewsListQuery = z.infer<typeof newsListQuerySchema>;
export type NewsCreateInput = z.infer<typeof newsCreateSchema>;
export type NewsUpdateInput = z.infer<typeof newsUpdateSchema>;
