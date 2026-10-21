import { RotateCcw, Search, X } from 'lucide-react';
import { useRef } from 'react';
import { LANGUAGES, PLATFORM_GROUPS, YEAR_RANGES } from '../data';
import type { CatalogFilters } from '../types';
import { FilterDropdown } from './ui/FilterDropdown';
import type { FilterOption } from './ui/FilterDropdown';

const PLATFORM_OPTIONS: ReadonlyArray<FilterOption> = PLATFORM_GROUPS.flatMap((group) =>
  group.options.map((platform) => ({
    value: platform,
    label: platform,
    group: group.label,
  })),
);

const LANGUAGE_OPTIONS: ReadonlyArray<FilterOption> = LANGUAGES.map((language) => ({
  value: language,
  label: language,
}));

const YEAR_OPTIONS: ReadonlyArray<FilterOption> = YEAR_RANGES.map((range) => ({
  value: range.value,
  label: range.label,
}));

interface ActiveFilter {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly onClear: () => void;
}

interface SearchToolbarProps {
  filters: CatalogFilters;
  resultCount: number;
  onFilterChange: (patch: Partial<CatalogFilters>) => void;
  onReset: () => void;
}

function getGamesCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} игра`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} игры`;
  return `${count} игр`;
}

/** Catalogue search, custom dropdown filters, active chips and reset. */
export function SearchToolbar({
  filters,
  resultCount,
  onFilterChange,
  onReset,
}: SearchToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const activeFilters: ActiveFilter[] = [];
  const yearRange = YEAR_RANGES.find((range) => range.value === filters.yearRange);

  if (filters.query) {
    activeFilters.push({
      key: 'query',
      label: 'Поиск',
      value: filters.query,
      onClear: () => onFilterChange({ query: '' }),
    });
  }

  if (filters.platform) {
    activeFilters.push({
      key: 'platform',
      label: 'Платформа',
      value: filters.platform,
      onClear: () => onFilterChange({ platform: '' }),
    });
  }

  if (filters.lang) {
    activeFilters.push({
      key: 'lang',
      label: 'Язык',
      value: filters.lang,
      onClear: () => onFilterChange({ lang: '' }),
    });
  }

  if (yearRange) {
    activeFilters.push({
      key: 'yearRange',
      label: 'Год',
      value: yearRange.label,
      onClear: () => onFilterChange({ yearRange: '' }),
    });
  }

  const hasFilters = activeFilters.length > 0;

  return (
    <section className="catalog-toolbar" aria-label="Поиск и фильтры каталога">
      <div className="catalog-toolbar__top">
        <div className="catalog-search">
          <Search size={19} aria-hidden="true" />
          <input
            ref={searchRef}
            id="catalogSearch"
            type="search"
            value={filters.query}
            onChange={(event) => onFilterChange({ query: event.target.value })}
            placeholder="Найти игру по названию"
            aria-label="Найти игру по названию"
          />
          {filters.query && (
            <button
              type="button"
              className="search-clear"
              aria-label="Очистить поиск"
              onClick={() => {
                onFilterChange({ query: '' });
                searchRef.current?.focus();
              }}
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="catalog-toolbar__meta">
          <span className="catalog-results" aria-live="polite" aria-atomic="true">
            {getGamesCountLabel(resultCount)}
          </span>
          <button
            type="button"
            className="filter-reset"
            onClick={onReset}
            disabled={!hasFilters}
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>Сбросить</span>
          </button>
        </div>
      </div>

      <div className="catalog-filters">
        <FilterDropdown
          id="platformFilter"
          label="Платформа"
          placeholder="Все платформы"
          value={filters.platform}
          options={PLATFORM_OPTIONS}
          onChange={(platform) => onFilterChange({ platform })}
        />

        <FilterDropdown
          id="langFilter"
          label="Язык издания"
          placeholder="Любой язык"
          value={filters.lang}
          options={LANGUAGE_OPTIONS}
          onChange={(lang) => onFilterChange({ lang })}
        />

        <FilterDropdown
          id="yearFilter"
          label="Год выпуска"
          placeholder="Все годы"
          value={filters.yearRange}
          options={YEAR_OPTIONS}
          onChange={(yearRange) => onFilterChange({ yearRange })}
        />
      </div>

      {activeFilters.length > 0 && (
        <div className="filter-chips" role="group" aria-label="Активные фильтры">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              className="filter-chip"
              aria-label={`Убрать фильтр «${filter.label}»: ${filter.value}`}
              onClick={filter.onClear}
            >
              <span className="filter-chip__key">{filter.label}</span>
              <span className="filter-chip__value">{filter.value}</span>
              <X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
