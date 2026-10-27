import { z } from 'zod';
import { paginationSchema } from './common.js';

export interface GameDto {
  id: string;
  title: string;
  publisher: string;
  developer: string;
  series: string;
  year: number | null;
  genres: string[];
  description: string;
  coverImage: string;
}

export interface EditionDto {
  id: string;
  gameId: string;
  name: string;
  platform: string;
  region: string;
  lang: string;
  media: string;
  /** Empty string when the release date is unknown. */
  releaseDate: string;
  description: string;
  contents: string[];
  coverImages: string[];
  barcode: string;
  dnsProductId: string;
  dnsProductCode: string;
  variants?: EditionVariantDto[];
}

export type EditionVariantDto = Omit<EditionDto,'variants'>;

export interface GameStatsDto {
  salesCount?: number;
  purchasesCount?: number;
  exchangeCount?: number;
  coverImages?: string[];
  platforms: string[];
  editionCount: number;
  ownedCount: number;
  lotsCount: number;
}

export interface GameWithStatsDto extends GameDto {
  stats: GameStatsDto;
}

export interface GameDetailDto extends GameDto {
  editions: EditionDto[];
}

export interface EditionDetailDto extends EditionDto {
  game: GameDto;
}

export interface PlatformDto {
  name: string;
  group: string;
  color: string;
  textColor: string;
}

export interface YearRangeDto {
  value: string;
  label: string;
  min: number;
  max: number | null;
}

export interface CatalogFiltersDto {
  platforms: PlatformDto[];
  languages: string[];
  regions: string[];
  editions: string[];
  completeness: string[];
  yearRanges: YearRangeDto[];
}

const optionalFilter = z.string().trim().max(100).optional();

export const catalogQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(120).optional(),
  platform: optionalFilter,
  lang: optionalFilter,
  region: optionalFilter,
  edition: optionalFilter,
  year: z.string().trim().max(20).optional(),
});

export const editionQuerySchema = paginationSchema.extend({
  gameId: optionalFilter,
  q: z.string().trim().max(120).optional(),
  platform: optionalFilter,
  lang: optionalFilter,
  region: optionalFilter,
  edition: optionalFilter,
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
export type EditionQuery = z.infer<typeof editionQuerySchema>;
