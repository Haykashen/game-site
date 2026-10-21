import { BarChart3, Gamepad2, Gavel, Library, Settings2, Tag, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavSectionId =
  | 'games'
  | 'auctions'
  | 'listings'
  | 'collection'
  | 'stats'
  | 'account'
  | 'settings';

export interface NavItem {
  readonly id: NavSectionId;
  readonly label: string;
  readonly pageTitle: string;
  readonly shortLabel: string;
  readonly path: string;
  readonly icon: LucideIcon;
}

export const NAV_ITEMS = {
  games: {
    id: 'games',
    label: 'Игры',
    pageTitle: 'Каталог игр',
    shortLabel: 'Игры',
    path: '/games',
    icon: Gamepad2,
  },
  auctions: {
    id: 'auctions',
    label: 'Аукционы',
    pageTitle: 'Аукционы',
    shortLabel: 'Аукционы',
    path: '/auctions',
    icon: Gavel,
  },
  listings: {
    id: 'listings',
    label: 'Объявления',
    pageTitle: 'Объявления',
    shortLabel: 'Объявления',
    path: '/listings',
    icon: Tag,
  },
  collection: {
    id: 'collection',
    label: 'Коллекция',
    pageTitle: 'Моя коллекция',
    shortLabel: 'Коллекция',
    path: '/collection',
    icon: Library,
  },
  stats: {
    id: 'stats',
    label: 'Статистика',
    pageTitle: 'Статистика',
    shortLabel: 'Статистика',
    path: '/stats',
    icon: BarChart3,
  },
  account: {
    id: 'account',
    label: 'Аккаунт',
    pageTitle: 'Аккаунт',
    shortLabel: 'Аккаунт',
    path: '/account',
    icon: UserRound,
  },
  settings: {
    id: 'settings',
    label: 'Настройки',
    pageTitle: 'Настройки',
    shortLabel: 'Настройки',
    path: '/settings',
    icon: Settings2,
  },
} as const satisfies Record<NavSectionId, NavItem>;

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: ReadonlyArray<NavItem>;
}

export const NAV_GROUPS: ReadonlyArray<NavGroup> = [
  {
    id: 'market',
    label: 'Маркет',
    items: [NAV_ITEMS.games, NAV_ITEMS.auctions, NAV_ITEMS.listings],
  },
  {
    id: 'shelf',
    label: 'Моя полка',
    items: [NAV_ITEMS.collection, NAV_ITEMS.stats],
  },
];

export const MOBILE_MORE_ITEMS: ReadonlyArray<NavItem> = [
  NAV_ITEMS.stats,
  NAV_ITEMS.account,
  NAV_ITEMS.settings,
];

export const MOBILE_ITEMS: ReadonlyArray<NavItem> = [
  NAV_ITEMS.games,
  NAV_ITEMS.auctions,
  NAV_ITEMS.listings,
  NAV_ITEMS.collection,
];

export function findNavItem(pathname: string): NavItem | null {
  return (
    Object.values(NAV_ITEMS).find(
      (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
    ) ?? null
  );
}
