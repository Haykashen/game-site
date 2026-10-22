import editionsJson from '../../../src/data/editions.json';
import filtersJson from '../../../src/data/filters.json';
import gamesJson from '../../../src/data/games.json';
import marketJson from '../../../src/data/market.json';
import platformsJson from '../../../src/data/platforms.json';

export interface SeedGame {
  id: string;
  title: string;
  publisher: string;
  developer: string;
  series: string;
  year: number;
  genres: string[];
  description: string;
  coverImage: string;
}

export interface SeedEdition {
  id: string;
  gameId: string;
  name: string;
  platform: string;
  region: string;
  lang: string;
  media: string;
  releaseDate: string;
  description: string;
  contents: string[];
  coverImages: string[];
  barcode: string;
  dnsProductId: string;
  dnsProductCode: string;
}

export interface SeedMarketEntry {
  id: string;
  kind: 'listing' | 'auction';
  listingType: 'sale' | 'purchase' | 'exchange' | null;
  gameId: string;
  editionId: string | null;
  title: string;
  condition: string;
  price: number;
  seller: string;
  description: string;
  bids: number;
  endsAt: string | null;
  createdAt: string;
  photos: string[];
  deliveryServices: Array<'russian-post' | 'cdek' | 'yandex' | 'other'>;
  internationalShipping: boolean | null;
  packagingPrice: number | null;
  shipsFrom: string;
  startsAt: string | null;
  bidStep: number | null;
}

export interface SeedPlatform {
  name: string;
  group: string;
  color: string;
  textColor: string;
}

export interface SeedYearRange {
  value: string;
  label: string;
  min: number;
  max: number | null;
}

export interface SeedFilters {
  languages: string[];
  regions: string[];
  editions: string[];
  completeness: string[];
  yearRanges: SeedYearRange[];
}

export const seedGames = gamesJson as unknown as SeedGame[];
export const seedEditions = editionsJson as unknown as SeedEdition[];
export const seedMarketEntries = marketJson as unknown as SeedMarketEntry[];
export const seedPlatforms = platformsJson as unknown as SeedPlatform[];
export const seedFilters = filtersJson as unknown as SeedFilters;

const yearRanges = new Map<string, { min: number; max?: number }>();

for (const range of seedFilters.yearRanges) {
  yearRanges.set(
    range.value,
    range.max === null ? { min: range.min } : { min: range.min, max: range.max },
  );
}

export function resolveYearRange(value: string | undefined):
  | { min: number; max?: number }
  | undefined {
  if (!value) return undefined;
  return yearRanges.get(value);
}
