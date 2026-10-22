import { z } from 'zod';
import {
  emptyOrDateOnlySchema,
  idSchema,
  nonNegativeRubleAmountSchema,
  photoReferenceSchema,
} from './common.js';

export const copyDetailsSchema = z.object({
  condition: z.string().trim().min(1).max(60).optional(),
  completeness: z.string().trim().min(1).max(60).optional(),
  purchasePrice: nonNegativeRubleAmountSchema.nullable().optional(),
  purchaseDate: emptyOrDateOnlySchema.optional(),
  notes: z.string().trim().max(2000).optional(),
  photos: z.array(photoReferenceSchema).max(6).optional(),
});

export const createCopySchema = copyDetailsSchema.extend({
  editionId: idSchema,
});

export const updateCopySchema = copyDetailsSchema;

export const editionQuantitySchema = z.object({
  quantity: z.coerce.number().int().min(0).max(99),
});

export interface CopyDto {
  id: string;
  editionId: string;
  condition: string;
  completeness: string;
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
