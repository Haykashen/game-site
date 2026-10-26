import type { MarketItemType } from '@discvault/shared';

/** A game in the catalogue: the abstract work, without a concrete release. */
export interface Game {
  id: string;
  title: string;
  publisher: string;
  developer: string;
  series: string;
  year: number | null;
  genres: string[];
  description: string;
  /** Representative artwork for the catalogue card; empty when there is none. */
  coverImage: string;
}

/**
 * A concrete release of a game: platform, region, language, media and the
 * physical contents that belong to this particular edition.
 */
export interface Edition {
  id: string;
  gameId: string;
  /** Standard, Launch Edition, Collector's Edition, … */
  name: string;
  platform: string;
  region: string;
  lang: string;
  media: string;
  /** ISO date (YYYY-MM-DD) or an empty string when the release date is unknown. */
  releaseDate: string;
  description: string;
  /** What is inside the box, e.g. "Диск", "Мануал", "Артбук". */
  contents: string[];
  /** Edition-level artwork. The first image is the card cover. */
  coverImages: string[];
  barcode: string;
  /**
   * DNS `data-product` id. It identifies the exact product card and is the
   * stable link between an edition and its external catalogue entry.
   */
  dnsProductId: string;
  /** DNS article / `data-code`; useful for search and cross-checks. */
  dnsProductCode: string;
}

/**
 * A physical copy owned by the user. Copies always point at an edition; the
 * collection UI groups rows by edition and shows the resulting quantity.
 */
export interface Copy {
  id: string;
  editionId: string;
  condition: string;
  completeness: string;
  /** Price paid in rubles; `null` when the user did not record it. */
  purchasePrice: number | null;
  /** ISO date (`YYYY-MM-DD`) of purchase; empty string when unknown. */
  purchaseDate: string;
  notes: string;
  photos: string[];
  createdAt: string;
}

/** Everything the collection form collects; ids are assigned by the store. */
export type CopyDraft = Omit<Copy, 'id' | 'createdAt'>;

/** Editable physical details; shared by every copy of one edition. */
export type CopyDetails = Pick<
  Copy,
  'condition' | 'completeness' | 'purchasePrice' | 'purchaseDate' | 'notes' | 'photos'
>;

/** Precomputed per-game numbers and badges used by catalogue cards. */
export interface GameStats {
  platforms: string[];
  editionCount: number;
  ownedCount: number;
  lotsCount: number;
  salesCount: number;
  purchasesCount: number;
  exchangeCount: number;
  coverImage: string;
}

export interface CatalogFilters {
  itemType: string;
  query: string;
  platform: string;
  lang: string;
  yearRange: string;
  region: string;
  edition: string;
  completeness: string;
}

/** Reply inside a community discussion topic. */
export interface DiscussionComment {
  id: string;
  /** Author id when the reply came from the API; absent in local demo data. */
  authorId?: string;
  author: string;
  body: string;
  /** Parent message for a threaded reply; `null` for a root-level reply. */
  parentId?: string | null;
  /** ISO timestamp of the reply. */
  createdAt: string;
  /** ISO timestamp of the last edit; absent when the reply was never edited. */
  updatedAt?: string;
  /** Nested replies loaded from the API. */
  replies?: DiscussionComment[];
}

/** A game-scoped topic shown in the community feed and the game card. */
export interface Discussion {
  id: string;
  gameId: string;
  title: string;
  /** One-line preview for the feed card. */
  excerpt: string;
  /** Full topic text; paragraphs are separated by blank lines. */
  body: string;
  author: string;
  /** Author id when the topic came from the API; absent in local demo data. */
  authorId?: string;
  /** ISO timestamp of the opening post. */
  createdAt: string;
  /** ISO timestamp of the last reply or edit. */
  updatedAt: string;
  views: number;
  tags: string[];
  /** Pinned topics surface first and are used as the game's main discussion. */
  pinned: boolean;
  /** Replies at every nesting level; used by feed cards without loading the thread. */
  commentCount?: number;
  comments: DiscussionComment[];
}

/** Editorial sections used by the news feed. */
export type NewsCategory = 'release' | 'guide' | 'community' | 'update';

/** A news article from the DiscVault editorial feed. */
export interface NewsPost {
  id: string;
  title: string;
  /** Short card preview and article lead. */
  excerpt: string;
  /** Full article text; paragraphs are separated by blank lines. */
  body: string;
  category: NewsCategory;
  author: string;
  /** Author id when the article came from the API; absent in local demo data. */
  authorId?: string;
  /** ISO timestamp of publication. */
  publishedAt: string;
  /** Related catalogue game, or null for site-wide stories. */
  gameId: string | null;
  tags: string[];
}

/** A marketplace entity: a fixed-price listing or an auction. */
export type MarketKind = 'listing' | 'auction';

/** Listings can offer a copy, look for one, or propose an exchange. */
export type MarketListingType = 'sale' | 'purchase' | 'exchange';

/** Owner-controlled lifecycle of a local listing or auction. */
export type MarketStatus = 'active' | 'sold' | 'closed';

/** Publication state: new lots wait in `pending` until an administrator approves them. */
export type MarketModerationStatus = 'pending' | 'visible' | 'hidden' | 'removed';

/** Courier service ids are stable so saved entries survive label edits. */
export type MarketDeliveryService = 'russian-post' | 'cdek' | 'yandex' | 'other';

export interface MarketEntry {
  itemType: MarketItemType;
  id: string;
  kind: MarketKind;
  /** Only listings have an intention; auctions always use `null`. */
  listingType: MarketListingType | null;
  gameId: string;
  /**
   * Exact edition for games; optional for game-related loot and buy requests.
   */
  editionId: string | null;
  title: string;
  condition: string;
  price: number;
  seller: string;
  description: string;
  /** Owner-controlled lifecycle; seeds and legacy entries default to `active`. */
  status: MarketStatus;
  /** Moderation visibility; missing on legacy local entries, which are visible. */
  moderationStatus?: MarketModerationStatus;
  /** Data URLs of up to six photos attached by the seller. */
  photos: string[];
  /** Courier services offered by the seller; empty for legacy entries. */
  deliveryServices: MarketDeliveryService[];
  /** `null` means the legacy entry predates the international shipping field. */
  internationalShipping: boolean | null;
  /** Packaging fee in rubles; `null` means the seller did not specify it. */
  packagingPrice: number | null;
  /** City or region the parcel is sent from; empty for legacy entries. */
  shipsFrom: string;
  /** Current bid count; always zero for fixed-price listings. */
  bids: number;
  /** Bid increment in rubles; `null` for listings and legacy auctions. */
  bidStep: number | null;
  /** ISO timestamp of the auction opening; `null` for fixed-price listings. */
  startsAt: string | null;
  /** ISO timestamp of the auction end; `null` for fixed-price listings. */
  endsAt: string | null;
  createdAt: string;
  /** Server author id; absent for entries that only exist in localStorage. */
  authorId?: string;
  /** Current auction price from the API; local demo entries keep it in `price`. */
  currentPrice?: number;
  /** Original auction starting price from the API. */
  startPrice?: number;
  /** Optimistic-concurrency version used by the bid endpoint. */
  version?: number;
  /** Auction winner after the API closes the lot. */
  winnerId?: string | null;
}

/** Everything the placement form collects; ids, counters and status are assigned by the store. */
export type MarketDraft = Omit<MarketEntry, 'id' | 'createdAt' | 'bids' | 'status'>;

export type Theme = 'light' | 'dark';
