import { Plus, RotateCcw } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { SearchToolbar } from '../components/SearchToolbar';
import { MarketCard } from '../components/market/MarketCard';
import { MarketDrawer } from '../components/market/MarketDrawer';
import { useCollection } from '../context/CollectionContext';
import { useMarketEntries } from '../hooks/useMarketEntries';
import { useMarketPanelParam } from '../hooks/useMarketPanelParam';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { marketCountLabel } from '../lib/market';
import { MARKET_FILTER_FIELDS, SEARCH_FILTER_PARAMS } from '../lib/searchFilterConfig';
import { selectVisibleMarketEntries } from '../lib/selectVisibleMarketEntries';
import type { MarketDraft, MarketKind } from '../types';

interface MarketPageProps {
  kind: MarketKind;
}

interface MarketCopy {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  hint: string;
  empty: string;
  searchPlaceholder: string;
  filteredEmpty: string;
}

const COPY: Record<MarketKind, MarketCopy> = {
  listing: {
    eyebrow: 'MARKET / LISTINGS',
    title: 'Объявления',
    description: 'Продажа, покупка и обмен изданиями между коллекционерами.',
    cta: 'Разместить объявление',
    hint: 'Фиксированные цены и прямые предложения',
    empty: 'Объявлений пока нет — разместите первое.',
    searchPlaceholder: 'Найти объявление, игру или продавца',
    filteredEmpty: 'По выбранным фильтрам объявлений не найдено.',
  },
  auction: {
    eyebrow: 'MARKET / AUCTIONS',
    title: 'Аукционы',
    description: 'Торги за редкие издания: ставки и время до закрытия лота.',
    cta: 'Разместить аукцион',
    hint: 'Ставки принимаются до окончания таймера',
    empty: 'Аукционов пока нет — запустите первый.',
    searchPlaceholder: 'Найти аукцион, игру или продавца',
    filteredEmpty: 'По выбранным фильтрам аукционов не найдено.',
  },
};

/** Shared marketplace page: search/filters, entity grid, CTA and URL drawer. */
export function MarketPage({ kind }: MarketPageProps) {
  const copy = COPY[kind];
  const navigate = useNavigate();
  const { games, editions } = useCollection();
  const { entries, addEntry } = useMarketEntries();
  const { values: filters, setValue, reset: resetFilters } = useUrlFilters(
    SEARCH_FILTER_PARAMS,
  );
  const {
    isComposing,
    composeGameId,
    composeEditionId,
    itemId,
    openCompose,
    openItem,
    closePanel,
  } = useMarketPanelParam();

  const gamesById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);
  const editionsById = useMemo(
    () => new Map(editions.map((edition) => [edition.id, edition])),
    [editions],
  );
  const kindItems = useMemo(
    () => entries.filter((entry) => entry.kind === kind),
    [entries, kind],
  );
  const visibleItems = useMemo(
    () => selectVisibleMarketEntries(kindItems, gamesById, editionsById, editions, filters),
    [editions, editionsById, filters, gamesById, kindItems],
  );
  const selectedEntry = useMemo(
    () => kindItems.find((entry) => entry.id === itemId) ?? null,
    [itemId, kindItems],
  );
  const selectedGame = selectedEntry
    ? gamesById.get(selectedEntry.gameId)
    : undefined;
  const selectedEdition =
    selectedEntry?.editionId ? editionsById.get(selectedEntry.editionId) : undefined;

  const handleCreated = useCallback(
    (draft: MarketDraft) => {
      const entry = addEntry(draft);
      openItem(entry.id, { replace: true });
    },
    [addEntry, openItem],
  );

  const handleOpenGame = useCallback(
    (gameId: string, editionId?: string) => {
      const params = new URLSearchParams({ game: gameId });
      if (editionId) params.set('editionId', editionId);
      navigate(`/games?${params.toString()}`);
    },
    [navigate],
  );

  return (
    <>
      <PageHeading
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        action={
          <button
            type="button"
            className="market-compose-btn"
            onClick={() => openCompose()}
          >
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
            {copy.cta}
          </button>
        }
      />

      <SearchToolbar
        key={kind}
        idPrefix={kind}
        ariaLabel={`Поиск и фильтры: ${copy.title}`}
        searchPlaceholder={copy.searchPlaceholder}
        query={filters.query}
        filterValues={filters}
        fields={MARKET_FILTER_FIELDS}
        resultCountLabel={marketCountLabel(visibleItems.length, kind)}
        onQueryChange={(query) => setValue('query', query)}
        onFilterChange={setValue}
        onReset={resetFilters}
      />

      <div className="market-list-head">
        <span className="market-list-hint">{copy.hint}</span>
      </div>

      {kindItems.length === 0 ? (
        <div className="market-empty">
          <p>{copy.empty}</p>
          <button
            type="button"
            className="market-compose-btn"
            onClick={() => openCompose()}
          >
            <Plus size={17} aria-hidden="true" />
            {copy.cta}
          </button>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="market-empty">
          <p>{copy.filteredEmpty}</p>
          <button
            type="button"
            className="btn-secondary market-empty__reset"
            onClick={resetFilters}
          >
            <RotateCcw size={15} aria-hidden="true" />
            Сбросить фильтры
          </button>
        </div>
      ) : (
        <section className="market-grid" aria-label={copy.title}>
          {visibleItems.map((entry) => (
            <MarketCard
              key={entry.id}
              entry={entry}
              game={gamesById.get(entry.gameId)}
              edition={entry.editionId ? editionsById.get(entry.editionId) : undefined}
              onSelect={openItem}
            />
          ))}
        </section>
      )}

      <MarketDrawer
        isOpen={isComposing || selectedEntry !== null}
        isComposing={isComposing}
        kind={kind}
        entry={selectedEntry}
        game={selectedGame}
        edition={selectedEdition}
        games={games}
        editions={editions}
        initialGameId={composeGameId}
        initialEditionId={composeEditionId}
        onClose={closePanel}
        onCreate={handleCreated}
        onOpenGame={handleOpenGame}
      />
    </>
  );
}
