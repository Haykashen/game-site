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
  year: number;
  lang: string;
  description: string;
  lots: Lot[];
}

export interface CatalogFilters {
  query: string;
  platform: string;
  lang: string;
  yearRange: string;
}

export type Theme = 'light' | 'dark';
