import { useEffect, useRef } from 'react';
import { GameBrowser } from '../components/GameBrowser';
import { ApiState } from '../components/ApiState';
import { SearchToolbar } from '../components/SearchToolbar';
import { useGameDrawerParam } from '../hooks/useGameDrawerParam';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { SEARCH_FILTER_PARAMS } from '../lib/searchFilterConfig';
import { useSearchFields } from '../hooks/useSearchFields';
import { useInfiniteCatalog } from '../hooks/useInfiniteCatalog';
import { useAuth } from '../context/AuthContext';

function gamesCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} игра`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} игры`;
  return `${count} игр`;
}

/** Catalogue with URL-backed filters, grid and the game detail drawer. */
export function GamesPage() {
  const fields = useSearchFields('catalog');
  const {user, refresh: refreshAuth, status} = useAuth();
  const { gameId, editionId, openGame, closeGame } = useGameDrawerParam();
  const { values: filters, setValue, reset } = useUrlFilters(SEARCH_FILTER_PARAMS);

  const catalog = useInfiniteCatalog(filters);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = sentinel.current;
    if (!target || !catalog.canLoad || catalog.loading || catalog.error || !catalog.hasMore || gameId || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      // A focused manual-load button can follow the page end as content grows.
      // Keep keyboard paging deliberate instead of draining the catalogue.
      if (!target.contains(document.activeElement) && entries.some((entry) => entry.isIntersecting)) void catalog.loadMore();
    }, {rootMargin: '600px 0px'});
    observer.observe(target);
    return () => observer.disconnect();
  }, [catalog.canLoad, catalog.loading, catalog.error, catalog.hasMore, catalog.loadMore, gameId]);

  return (
    <>
      <h1 className="sr-only">Каталог игр</h1>
      <ApiState loading={catalog.loading && catalog.items.length === 0} error={catalog.error} onRetry={status === 'offline' ? refreshAuth : catalog.loadMore} />
      <SearchToolbar
        idPrefix="catalog"
        ariaLabel="Поиск и фильтры каталога"
        searchPlaceholder="Найти игру по названию"
        query={filters.query}
        filterValues={filters}
        fields={fields}
        resultCountLabel={gamesCountLabel(catalog.total)}
        onQueryChange={(query) => setValue('query', query)}
        onFilterChange={setValue}
        onReset={reset}
      />
      <GameBrowser
        key={user?.id ?? 'guest'}
        games={catalog.items}
        gameId={gameId}
        editionId={editionId}
        onOpenGame={openGame}
        onCloseGame={closeGame}
        emptyText={catalog.loading ? 'Загружаем игры…' : catalog.error ? 'Не удалось загрузить игры.' : 'Игры не найдены'}
      />
      <div ref={sentinel} className="catalog-pagination" aria-live="polite">
        {catalog.items.length > 0 && <span>Показано {catalog.items.length} из {catalog.total}</span>}
        {catalog.hasMore && !catalog.error && catalog.canLoad && <button type="button" className="btn-secondary" disabled={catalog.loading} onClick={(event) => {if (event.detail > 0) event.currentTarget.blur(); void catalog.loadMore();}}>{catalog.loading ? 'Загружаем…' : 'Загрузить ещё'}</button>}
      </div>
    </>
  );
}
