import {z} from 'zod';
import {idSchema} from './common.js';
export const shareCopySchema = z.object({copyId: idSchema, topic: z.string().trim().max(200).default(''), caption: z.string().trim().max(1000).default('')});
export interface CopyShareDto {
  id: string; topic?: string; caption: string; photos: string[]; condition: string; completeness: string; region: string; createdAt: string;
  likesCount: number; commentsCount: number; likedByMe: boolean;
  author: {id: string; displayName: string; rating: number | null};
  game: {id: string; title: string};
  edition: {id: string; name: string; platform: string};
}

export const showcaseCommentSchema = z.object({body: z.string().trim().min(1, 'Напишите комментарий.').max(2000)});
export interface ShowcaseCommentDto {id: string; body: string; createdAt: string; author: {id: string; displayName: string; rating: number | null}}
export interface ShowcaseSocialDto {likesCount: number; likedByMe: boolean; commentsCount: number}
