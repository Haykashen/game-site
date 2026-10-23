import { z } from 'zod';
import type { PublicUser } from './auth.js';
import { idSchema, paginationSchema } from './common.js';
import type { MarketKind } from './market.js';

export const notificationTypeSchema = z.enum([
  'bid_placed',
  'bid_outbid',
  'auction_won',
  'auction_lost',
  'auction_sold',
  'auction_closed',
  'entry_created',
  'entry_sold',
  'entry_closed',
  'entry_reopened',
  'entry_price_changed',
  'deal_created',
]);

export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationListQuerySchema = paginationSchema.extend({
  status: z.enum(['all', 'unread']).default('all'),
});

export const gameSubscriptionUpdateSchema = z.object({
  notifyAuctions: z.boolean().optional(),
  notifyListings: z.boolean().optional(),
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type GameSubscriptionUpdate = z.infer<typeof gameSubscriptionUpdateSchema>;

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  marketEntryId: string | null;
  marketEntryTitle: string | null;
  marketEntryKind: MarketKind | null;
  gameId: string | null;
  gameTitle: string | null;
  actor: PublicUser | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationReadResponse {
  notification: NotificationDto;
  unreadCount: number;
}

export interface NotificationReadAllResponse {
  updated: number;
  unreadCount: number;
}

export interface GameSubscriptionDto {
  id: string;
  gameId: string;
  gameTitle: string;
  notifyAuctions: boolean;
  notifyListings: boolean;
  createdAt: string;
}

export interface MarketEntrySubscriptionDto {
  id: string;
  marketEntryId: string;
  entryTitle: string;
  entryKind: MarketKind;
  gameId: string;
  createdAt: string;
}

export interface SubscriptionListDto {
  games: GameSubscriptionDto[];
  entries: MarketEntrySubscriptionDto[];
}

/** Path parameter used by the subscription routes. */
export const subscriptionGameParamsSchema = z.object({ gameId: idSchema });
export const subscriptionEntryParamsSchema = z.object({ entryId: idSchema });
export const notificationParamsSchema = z.object({ id: z.string().uuid() });
