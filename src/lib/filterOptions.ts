import {
  COMPLETENESS,
  EDITIONS,
  LANGUAGES,
  PLATFORM_GROUPS,
  REGIONS,
  YEAR_RANGES,
} from '../data/reference';

export interface FilterOption {
  readonly value: string;
  readonly label: string;
  readonly group?: string;
}

export const PLATFORM_OPTIONS: readonly FilterOption[] = PLATFORM_GROUPS.flatMap((group) =>
  group.options.map((platform) => ({
    value: platform,
    label: platform,
    group: group.label,
  })),
);

export const REGION_OPTIONS: readonly FilterOption[] = REGIONS.map((region) => ({
  value: region,
  label: region,
}));

export const EDITION_OPTIONS: readonly FilterOption[] = EDITIONS.map((edition) => ({
  value: edition,
  label: edition,
}));

export const COMPLETENESS_OPTIONS: readonly FilterOption[] = COMPLETENESS.map((value) => ({
  value,
  label: value,
}));

export const LANGUAGE_OPTIONS: readonly FilterOption[] = LANGUAGES.map((language) => ({
  value: language,
  label: language,
}));

export const YEAR_OPTIONS: readonly FilterOption[] = YEAR_RANGES.map((range) => ({
  value: range.value,
  label: range.label,
}));
