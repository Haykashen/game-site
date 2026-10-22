import { Filter, FilterX, Search, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { cx } from '../lib/cx';
import type { SearchFilterField } from '../lib/searchFilterConfig';
import { FilterDropdown } from './ui/FilterDropdown';

interface ActiveFilter {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly onClear: () => void;
}

interface SearchToolbarProps<Key extends string> {
  /** Prefix for the search input id, e.g. `catalog` or `auction`. */
  idPrefix: string;
  ariaLabel: string;
  searchPlaceholder: string;
  query: string;
  filterValues: Readonly<Record<Key, string>>;
  fields: readonly SearchFilterField<Key>[];
  resultCountLabel: string;
  onQueryChange: (query: string) => void;
  onFilterChange: (key: Key, value: string) => void;
  onReset: () => void;
}

/** Shared search, dropdown filters, active chips and reset for every section. */
export function SearchToolbar<Key extends string>({
  idPrefix,
  ariaLabel,
  searchPlaceholder,
  query,
  filterValues,
  fields,
  resultCountLabel,
  onQueryChange,
  onFilterChange,
  onReset,
}: SearchToolbarProps<Key>) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const activeFilters: ActiveFilter[] = [];

  if (query) {
    activeFilters.push({
      key: 'query',
      label: 'Поиск',
      value: query,
      onClear: () => onQueryChange(''),
    });
  }

  for (const field of fields) {
    const value = filterValues[field.key];

    if (!value) continue;

    const optionLabel = field.options.find((option) => option.value === value)?.label ?? value;

    activeFilters.push({
      key: field.key,
      label: field.label,
      value: optionLabel,
      onClear: () => onFilterChange(field.key, ''),
    });
  }

  const activeFilterCount = fields.reduce(
    (count, field) => count + (filterValues[field.key] ? 1 : 0),
    0,
  );
  const hasFilters = activeFilters.length > 0;
  const searchId = `${idPrefix}Search`;
  const filtersId = `${idPrefix}Filters`;

  return (
    <section className="catalog-toolbar" aria-label={ariaLabel}>
      <div className="catalog-toolbar__top">
        <div className="catalog-search">
          <Search size={19} aria-hidden="true" />
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
          />
          {query && (
            <button
              type="button"
              className="search-clear"
              aria-label="Очистить поиск"
              onClick={() => {
                onQueryChange('');
                searchRef.current?.focus();
              }}
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="catalog-toolbar__meta">
          <span className="catalog-results" aria-live="polite" aria-atomic="true">
            {resultCountLabel}
          </span>
          <div className="catalog-toolbar__actions">
            <button
              type="button"
              className={cx(
                'filter-icon-btn',
                'filter-toggle',
                isFiltersOpen && 'is-open',
              )}
              aria-expanded={isFiltersOpen}
              aria-controls={filtersId}
              aria-label={isFiltersOpen ? 'Скрыть фильтры' : 'Показать фильтры'}
              title={isFiltersOpen ? 'Скрыть фильтры' : 'Показать фильтры'}
              onClick={() => setIsFiltersOpen((isOpen) => !isOpen)}
            >
              <Filter size={17} aria-hidden="true" />
              {activeFilterCount > 0 && (
                <span className="filter-toggle__count" aria-hidden="true">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              type="button"
              className="filter-icon-btn filter-reset"
              onClick={onReset}
              disabled={!hasFilters}
              aria-label="Сбросить фильтры"
              title="Сбросить фильтры"
            >
              <FilterX size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {isFiltersOpen && (
        <div className="catalog-filters" id={filtersId}>
          {fields.map((field) => (
            <FilterDropdown
              key={field.id}
              id={field.id}
              label={field.label}
              placeholder={field.placeholder}
              value={filterValues[field.key]}
              options={field.options}
              onChange={(value) => onFilterChange(field.key, value)}
            />
          ))}
        </div>
      )}

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
