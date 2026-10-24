import type { NavSectionId } from './navigation';

export type HeaderBannerTone =
  | 'lime'
  | 'amber'
  | 'pink'
  | 'emerald'
  | 'violet'
  | 'muted';

export interface HeaderBannerMeta {
  /** Small monospace label shown above the page title. */
  readonly kicker: string;
  readonly tone: HeaderBannerTone;
}

export const HEADER_BANNERS: Record<NavSectionId, HeaderBannerMeta> = {
  games: { kicker: 'MARKET / CATALOG', tone: 'lime' },
  auctions: { kicker: 'MARKET / AUCTIONS', tone: 'amber' },
  listings: { kicker: 'MARKET / LISTINGS', tone: 'pink' },
  sales: { kicker: 'MARKET / SALES', tone: 'pink' },
  purchases: { kicker: 'MARKET / PURCHASES', tone: 'amber' },
  exchange: { kicker: 'MARKET / EXCHANGE', tone: 'violet' },
  discussions: { kicker: 'COMMUNITY / DISCUSSIONS', tone: 'violet' },
  news: { kicker: 'COMMUNITY / NEWS', tone: 'amber' },
  collection: { kicker: 'SHELF / COLLECTION', tone: 'emerald' },
  notifications: { kicker: 'SHELF / NOTIFICATIONS', tone: 'violet' },
  stats: { kicker: 'SHELF / STATISTICS', tone: 'lime' },
  account: { kicker: 'PROFILE / ACCOUNT', tone: 'violet' },
  settings: { kicker: 'SYSTEM / SETTINGS', tone: 'muted' },
  admin: { kicker: 'SYSTEM / MODERATION', tone: 'pink' },
};

export const PROFILE_BANNER: HeaderBannerMeta = {
  kicker: 'PROFILE / COLLECTOR',
  tone: 'violet',
};

export const DEFAULT_BANNER: HeaderBannerMeta = {
  kicker: 'DISCVAULT / ARCHIVE',
  tone: 'lime',
};
