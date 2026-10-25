import type { CatalogFilters } from '../types';
import { MARKET_ITEM_OPTIONS } from '@discvault/shared';
import {
  COMPLETENESS_OPTIONS,
  EDITION_OPTIONS,
  LANGUAGE_OPTIONS,
  PLATFORM_OPTIONS,
  REGION_OPTIONS,
  YEAR_OPTIONS,
} from './filterOptions';
import type { FilterOption } from './filterOptions';

export type CatalogFilterKey = Exclude<keyof CatalogFilters, 'query'>;

export interface UrlFilterField<Key extends string> {
  readonly key: Key;
  readonly param: string;
}

export interface SearchFilterField<Key extends string> {
  readonly id: string;
  readonly key: Key;
  readonly label: string;
  readonly placeholder: string;
  readonly options: readonly FilterOption[];
}

/** URL keys are shared by the catalogue and both marketplace sections. */
export const SEARCH_FILTER_PARAMS: readonly UrlFilterField<keyof CatalogFilters>[] = [
  { key: 'itemType', param: 'itemType' },
  { key: 'query', param: 'q' },
  { key: 'platform', param: 'platform' },
  { key: 'lang', param: 'lang' },
  { key: 'yearRange', param: 'year' },
  { key: 'region', param: 'region' },
  { key: 'edition', param: 'edition' },
  { key: 'completeness', param: 'completeness' },
];

export const CATALOG_FILTER_FIELDS: readonly SearchFilterField<CatalogFilterKey>[] = [
  {
    id: 'platformFilter',
    key: 'platform',
    label: 'Платформа',
    placeholder: 'Все платформы',
    options: PLATFORM_OPTIONS,
  },
  {
    id: 'regionFilter',
    key: 'region',
    label: 'Регион',
    placeholder: 'Все регионы',
    options: REGION_OPTIONS,
  },
  {
    id: 'editionFilter',
    key: 'edition',
    label: 'Издание',
    placeholder: 'Все издания',
    options: EDITION_OPTIONS,
  },
  {
    id: 'langFilter',
    key: 'lang',
    label: 'Язык издания',
    placeholder: 'Любой язык',
    options: LANGUAGE_OPTIONS,
  },
  {
    id: 'yearFilter',
    key: 'yearRange',
    label: 'Год выпуска',
    placeholder: 'Все годы',
    options: YEAR_OPTIONS,
  },
];

export const MARKET_FILTER_FIELDS: readonly SearchFilterField<CatalogFilterKey>[] = [
  { id: 'marketItemTypeFilter', key: 'itemType', label: 'Предмет', placeholder: 'Игры и весь лут', options: MARKET_ITEM_OPTIONS },
  {
    id: 'marketPlatformFilter',
    key: 'platform',
    label: 'Платформа',
    placeholder: 'Все платформы',
    options: PLATFORM_OPTIONS,
  },
  {
    id: 'marketRegionFilter',
    key: 'region',
    label: 'Регион',
    placeholder: 'Все регионы',
    options: REGION_OPTIONS,
  },
  {
    id: 'marketEditionFilter',
    key: 'edition',
    label: 'Издание',
    placeholder: 'Все издания',
    options: EDITION_OPTIONS,
  },
  {
    id: 'marketCompletenessFilter',
    key: 'completeness',
    label: 'Комплектность',
    placeholder: 'Любая комплектность',
    options: COMPLETENESS_OPTIONS,
  },
  {
    id: 'marketLangFilter',
    key: 'lang',
    label: 'Язык издания',
    placeholder: 'Любой язык',
    options: LANGUAGE_OPTIONS,
  },
  {
    id: 'marketYearFilter',
    key: 'yearRange',
    label: 'Год выпуска',
    placeholder: 'Все годы',
    options: YEAR_OPTIONS,
  },
];
