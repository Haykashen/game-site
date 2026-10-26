import { z } from 'zod';
import type { UserRole, UserStatus } from './auth.js';

export const analyticsPeriodSchema = z
  .enum(['7d', '30d', '90d', '365d'])
  .default('30d');

export const analyticsQuerySchema = z.object({
  period: analyticsPeriodSchema,
});

export type AnalyticsPeriod = z.infer<typeof analyticsPeriodSchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export interface AnalyticsGamesOverviewDto {
  total: number;
  editions: number;
  copies: number;
  newInPeriod: number;
}

export interface AnalyticsUsersOverviewDto {
  total: number;
  active: number;
  suspended: number;
  newInPeriod: number;
  withCollection: number;
  withListings: number;
}

export interface AnalyticsMarketOverviewDto {
  activeListings: number;
  activeAuctions: number;
  entriesInPeriod: number;
  completedDeals: number;
  completedDealsInPeriod: number;
  gmvMinor: number;
  gmvInPeriodMinor: number;
  bids: number;
}

export interface AnalyticsModerationOverviewDto {
  pendingReports: number;
  pendingMarketEntries: number;
}

export interface AnalyticsOverviewDto {
  games: AnalyticsGamesOverviewDto;
  users: AnalyticsUsersOverviewDto;
  market: AnalyticsMarketOverviewDto;
  moderation: AnalyticsModerationOverviewDto;
}

export interface AnalyticsTrendPointDto {
  /** Stable bucket key: `YYYY-MM-DD` for days or `YYYY-MM` for months. */
  date: string;
  label: string;
  users: number;
  entries: number;
  deals: number;
}

export interface AnalyticsTrendDto {
  bucket: 'day' | 'month';
  points: AnalyticsTrendPointDto[];
}

export interface AnalyticsGameDto {
  id: string;
  title: string;
  coverImage: string;
  year: number;
  publisher: string;
  editions: number;
  copies: number;
  entries: number;
  activeEntries: number;
  soldEntries: number;
  bids: number;
  deals: number;
  gmvMinor: number;
  averageDealMinor: number;
  subscriptions: number;
  rating: number | null;
  ratingsCount: number;
}

export interface AnalyticsUserDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
  status: UserStatus;
  deals: number;
  gmvMinor: number;
  listings: number;
  copies: number;
}

export interface AnalyticsRoleDto {
  role: UserRole;
  count: number;
}

export interface AdminAnalyticsDto {
  period: AnalyticsPeriod;
  generatedAt: string;
  overview: AnalyticsOverviewDto;
  trend: AnalyticsTrendDto;
  topGames: AnalyticsGameDto[];
  topSellers: AnalyticsUserDto[];
  topBuyers: AnalyticsUserDto[];
  topCollectors: AnalyticsUserDto[];
  roles: AnalyticsRoleDto[];
}
