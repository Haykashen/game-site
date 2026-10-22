import { z } from 'zod';
import type { PublicUser } from './auth.js';
import type { MarketEntryDto, MarketKind } from './market.js';
import { paginationSchema } from './common.js';

export const dealStatusSchema = z.enum(['pending', 'completed', 'cancelled']);
export const dealStatusUpdateSchema = z.object({
  status: z.enum(['completed', 'cancelled']),
});

export const dealsQuerySchema = paginationSchema.extend({
  role: z.enum(['all', 'buyer', 'seller']).default('all'),
  status: z.enum(['all', 'pending', 'completed', 'cancelled']).default('all'),
});

export const reviewCreateSchema = z.object({
  rating: z.number().int().min(1, 'Поставьте оценку от 1 до 5.').max(5),
  text: z.string().trim().max(1000).default(''),
});

export type DealStatus = z.infer<typeof dealStatusSchema>;
export type DealStatusUpdate = z.infer<typeof dealStatusUpdateSchema>;
export type DealsQuery = z.infer<typeof dealsQuerySchema>;
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

export interface DealEntrySummary {
  id: string;
  kind: MarketKind;
  title: string;
  gameId: string;
  editionId: string | null;
  price: number;
  status: string;
}

export interface ReviewDto {
  id: string;
  dealId: string;
  author: PublicUser;
  target: PublicUser;
  rating: number;
  text: string;
  createdAt: string;
}

export interface DealDto {
  id: string;
  marketEntryId: string;
  entry: DealEntrySummary;
  buyer: PublicUser;
  seller: PublicUser;
  /** Agreed amount in rubles. */
  amount: number;
  status: DealStatus;
  createdAt: string;
  completedAt: string | null;
  reviews: ReviewDto[];
  /** The current user still has to review the counterparty. */
  canReview: boolean;
  /** The current user can mark a pending deal as completed. */
  canComplete: boolean;
}

export interface DealWithEntry extends DealDto {
  /** Populated only by endpoints that load the full market entry. */
  fullEntry?: MarketEntryDto;
}
