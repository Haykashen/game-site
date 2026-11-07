import type { GameDto, EditionDto } from './catalog.js';
import { z } from 'zod';
import {
  emptyOrDateOnlySchema,
  idSchema,
  MAX_RUBLE_AMOUNT,
  photoReferenceSchema,
} from './common.js';

export const copyDetailsSchema = z.object({
  region: z.string().trim().max(40).nullable().optional(),
  condition: z.string().trim().min(1).max(60).optional(),
  completeness: z.string().trim().min(1).max(60).optional(),
  purchasePrice: z.coerce.number().min(0).max(MAX_RUBLE_AMOUNT)
    .refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, 'Укажите не более двух знаков после запятой.').nullable().optional(),
  purchaseDate: emptyOrDateOnlySchema.optional(),
  notes: z.string().trim().max(2000).optional(),
  photos: z.array(photoReferenceSchema).max(6).optional(),
});

export const createCopySchema = copyDetailsSchema.extend({
  editionId: idSchema,
});

export const updateCopySchema = copyDetailsSchema.extend({quantity: z.number().int().min(1).max(99).optional()});

export const editionQuantitySchema = z.object({
  quantity: z.coerce.number().int().min(0).max(99),
});

export interface CopyDto {
  id: string;
  editionId: string;
  condition: string;
  completeness: string;
  region?: string | null;
  /** Price paid in rubles; `null` when not recorded. */
  purchasePrice: number | null;
  /** `YYYY-MM-DD` or an empty string. */
  purchaseDate: string;
  notes: string;
  photos: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionStatsDto {
  copiesCount: number;
  editionsCount: number;
  gamesCount: number;
  totalSpent: number;
  averagePrice: number | null;
  platforms: Array<{ platform: string; copies: number }>;
}

export type CopyDetailsInput = z.infer<typeof copyDetailsSchema>;
export type CreateCopyInput = z.infer<typeof createCopySchema>;
export type UpdateCopyInput = z.infer<typeof updateCopySchema>;

export interface CollectionCatalogDto { games: GameDto[]; editions: EditionDto[] }
