/** A listing is either an offer to sell or a request to buy. */
export type LotType = 'sale' | 'purchase';

export interface Lot {
  id: string;
  type: LotType;
  title: string;
  condition: string;
  user: string;
  price: number;
}

/** Everything the form collects; the id is assigned by the store. */
export type LotDraft = Omit<Lot, 'id'>;

export interface Game {
  id: string;
  title: string;
  platform: string;
  publisher: string;
  developer: string;
  series: string;
  year: number;
  lang: string;
  region: string;
  edition: string;
  completeness: string;
  media: string;
  description: string;
  lots: Lot[];
}

export interface CatalogFilters {
  query: string;
  platform: string;
  lang: string;
  yearRange: string;
  region: string;
  edition: string;
  completeness: string;
}

/** A marketplace entity: a fixed-price listing or an auction. */
export type MarketKind = 'listing' | 'auction';

/** Courier service ids are stable so saved entries survive label edits. */
export type MarketDeliveryService = 'russian-post' | 'cdek' | 'yandex' | 'other';

export interface MarketEntry {
  id: string;
  kind: MarketKind;
  gameId: string;
  title: string;
  /** Edition of the exact copy, preselected from the linked game. */
  edition: string;
  /** Region of the exact copy, preselected from the linked game. */
  region: string;
  condition: string;
  price: number;
  seller: string;
  description: string;
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
}

/** Everything the placement form collects; ids and counters are assigned by the store. */
export type MarketDraft = Omit<MarketEntry, 'id' | 'createdAt' | 'bids'>;

export type Theme = 'light' | 'dark';
