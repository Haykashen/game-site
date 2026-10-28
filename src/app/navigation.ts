import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  ClipboardCheck,
  Database,
  Gamepad2,
  Gavel,
  Library,
  MessagesSquare,
  Newspaper,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Tag,
  UserRound,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavSectionId =
  | 'games'
  | 'auctions'
  | 'listings'
  | 'sales'
  | 'purchases'
  | 'exchange'
  | 'discussions'
  | 'news'
  | 'collection'
  | 'notifications'
  | 'stats'
  | 'account'
  | 'settings'
  | 'analytics'
  | 'marketReview'
  | 'admin'
  | 'adminUsers'
  | 'adminReference'
  | 'adminData';

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
  /** Shared, unfiltered listing feed. Kept for old links and the mobile tab. */
  listings: {
    id: 'listings',
    label: 'Объявления',
    pageTitle: 'Объявления',
    shortLabel: 'Объявления',
    path: '/listings',
    icon: Tag,
  },
  sales: {
    id: 'sales',
    label: 'Продажи',
    pageTitle: 'Продажи',
    shortLabel: 'Продажи',
    path: '/listings/sales',
    icon: Tag,
  },
  purchases: {
    id: 'purchases',
    label: 'Покупки',
    pageTitle: 'Покупки',
    shortLabel: 'Покупки',
    path: '/listings/purchases',
    icon: ShoppingBag,
  },
  exchange: {
    id: 'exchange',
    label: 'Обмен',
    pageTitle: 'Обмен',
    shortLabel: 'Обмен',
    path: '/listings/exchange',
    icon: ArrowLeftRight,
  },
  discussions: {
    id: 'discussions',
    label: 'Обсуждения',
    pageTitle: 'Обсуждения',
    shortLabel: 'Темы',
    path: '/discussions',
    icon: MessagesSquare,
  },
  news: {
    id: 'news',
    label: 'Новости',
    pageTitle: 'Новости',
    shortLabel: 'Новости',
    path: '/news',
    icon: Newspaper,
  },
  collection: {
    id: 'collection',
    label: 'Коллекция',
    pageTitle: 'Моя коллекция',
    shortLabel: 'Коллекция',
    path: '/collection',
    icon: Library,
  },
  notifications: {
    id: 'notifications',
    label: 'Уведомления',
    pageTitle: 'Уведомления',
    shortLabel: 'События',
    path: '/notifications',
    icon: Bell,
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
  analytics: {
    id: 'analytics',
    label: 'Аналитика',
    pageTitle: 'Аналитика',
    shortLabel: 'Аналитика',
    path: '/admin/analytics',
    icon: ChartNoAxesCombined,
  },
  marketReview: {
    id: 'marketReview',
    label: 'Модерация',
    pageTitle: 'Модерация',
    shortLabel: 'Модерация',
    path: '/admin/market',
    icon: ClipboardCheck,
  },
  admin: {
    id: 'admin',
    label: 'Жалобы',
    pageTitle: 'Жалобы',
    shortLabel: 'Жалобы',
    path: '/admin/reports',
    icon: ShieldCheck,
  },
  adminUsers: {
    id: 'adminUsers',
    label: 'Пользователи',
    pageTitle: 'Пользователи',
    shortLabel: 'Люди',
    path: '/admin/users',
    icon: Users,
  },
  adminReference: {
    id: 'adminReference', label: 'Справочники', pageTitle: 'Справочники', shortLabel: 'Справочники',
    path: '/admin/reference', icon: BookOpen,
  },
  adminData: {
    id: 'adminData', label: 'Данные', pageTitle: 'Данные проекта', shortLabel: 'Данные',
    path: '/admin/data', icon: Database,
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
    items: [
      NAV_ITEMS.games,
      NAV_ITEMS.auctions,
      NAV_ITEMS.sales,
      NAV_ITEMS.purchases,
      NAV_ITEMS.exchange,
    ],
  },
  {
    id: 'community',
    label: 'Сообщество',
    items: [NAV_ITEMS.discussions, NAV_ITEMS.news],
  },
  {
    id: 'shelf',
    label: 'Моя полка',
    items: [NAV_ITEMS.collection, NAV_ITEMS.notifications, NAV_ITEMS.stats],
  },
];

export const MOBILE_MORE_ITEMS: ReadonlyArray<NavItem> = [
  NAV_ITEMS.discussions,
  NAV_ITEMS.news,
  NAV_ITEMS.notifications,
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
    Object.values(NAV_ITEMS)
      .filter(
        (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
      )
      // Nested routes such as /listings/sales must win over /listings.
      .sort((left, right) => right.path.length - left.path.length)[0] ?? null
  );
}
