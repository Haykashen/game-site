import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GameBrowser } from '../components/GameBrowser';
import { SearchToolbar } from '../components/SearchToolbar';
import { useCollection } from '../context/CollectionContext';
import { selectVisibleGames } from '../lib/selectVisibleGames';
import type { CatalogFilters } from '../types';

const FILTER_PARAMS: ReadonlyArray<readonly [keyof CatalogFilters, string]> = [
  ['query', 'q'],
  ['platform', 'platform'],
  ['lang', 'lang'],
  ['yearRange', 'year'],
];

function readFilters(params: URLSearchParams): CatalogFilters {
  return {
    query: params.get('q') ?? '',
    platform: params.get('platform') ?? '',
    lang: params.get('lang') ?? '',
    yearRange: params.get('year') ?? '',
  };
}

/** Catalogue with URL-backed filters, grid and the game detail drawer. */
export function GamesPage() {
  const { games } = useCollection();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);

  const updateFilters = useCallback(
    (patch: Partial<CatalogFilters>) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);

          for (const [field, paramName] of FILTER_PARAMS) {
            const value = patch[field];
            if (value === undefined) continue;

            if (value) {
              next.set(paramName, value);
            } else {
              next.delete(paramName);
            }
          }

          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);

        for (const [, paramName] of FILTER_PARAMS) {
          next.delete(paramName);
        }

        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const visibleGames = useMemo(
    () => selectVisibleGames(games, filters),
    [filters, games],
  );

  return (
    <>
      <h1 className="sr-only">Каталог игр</h1>
      <SearchToolbar
        filters={filters}
        resultCount={visibleGames.length}
        onFilterChange={updateFilters}
        onReset={resetFilters}
      />
      <GameBrowser games={visibleGames} />
    </>
  );
}
