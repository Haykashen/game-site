import { useMemo } from 'react';
import { GameBrowser } from '../components/GameBrowser';
import { SearchToolbar } from '../components/SearchToolbar';
import { useCollection } from '../context/CollectionContext';
import { useGameDrawerParam } from '../hooks/useGameDrawerParam';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { CATALOG_FILTER_FIELDS, SEARCH_FILTER_PARAMS } from '../lib/searchFilterConfig';
import { selectVisibleGames } from '../lib/selectVisibleGames';

function gamesCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} игра`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} игры`;
  return `${count} игр`;
}

/** Catalogue with URL-backed filters, grid and the game detail drawer. */
export function GamesPage() {
  const { games, editions } = useCollection();
  const { gameId, editionId, openGame, closeGame } = useGameDrawerParam();
  const { values: filters, setValue, reset } = useUrlFilters(SEARCH_FILTER_PARAMS);

  const visibleGames = useMemo(
    () => selectVisibleGames(games, editions, filters),
    [editions, filters, games],
  );

  return (
    <>
      <h1 className="sr-only">Каталог игр</h1>
      <SearchToolbar
        idPrefix="catalog"
        ariaLabel="Поиск и фильтры каталога"
        searchPlaceholder="Найти игру по названию"
        query={filters.query}
        filterValues={filters}
        fields={CATALOG_FILTER_FIELDS}
        resultCountLabel={gamesCountLabel(visibleGames.length)}
        onQueryChange={(query) => setValue('query', query)}
        onFilterChange={setValue}
        onReset={reset}
      />
      <GameBrowser
        games={visibleGames}
        gameId={gameId}
        editionId={editionId}
        onOpenGame={openGame}
        onCloseGame={closeGame}
      />
    </>
  );
}
