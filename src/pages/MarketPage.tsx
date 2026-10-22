import { Plus, RotateCcw, UserRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { SearchToolbar } from '../components/SearchToolbar';
import { MarketCard } from '../components/market/MarketCard';
import { MarketDrawer } from '../components/market/MarketDrawer';
import { useCollection } from '../context/CollectionContext';
import { useMarketEntries } from '../hooks/useMarketEntries';
import { useMarketPanelParam } from '../hooks/useMarketPanelParam';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { cx } from '../lib/cx';
import { marketCountLabel } from '../lib/market';
import { MARKET_FILTER_FIELDS, SEARCH_FILTER_PARAMS } from '../lib/searchFilterConfig';
import { selectVisibleMarketEntries } from '../lib/selectVisibleMarketEntries';
import type { MarketDraft, MarketKind, MarketStatus } from '../types';

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
  const {
    entries,
    ownEntryIds,
    addEntry,
    updateEntry,
    removeEntry,
    setEntryStatus,
  } = useMarketEntries();
  const [showOwn, setShowOwn] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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
  const ownCount = useMemo(
    () => kindItems.filter((entry) => ownEntryIds.has(entry.id)).length,
    [kindItems, ownEntryIds],
  );
  const baseItems = useMemo(
    () =>
      kindItems.filter((entry) =>
        showOwn ? ownEntryIds.has(entry.id) : entry.status === 'active',
      ),
    [kindItems, ownEntryIds, showOwn],
  );
  const visibleItems = useMemo(
    () => selectVisibleMarketEntries(baseItems, gamesById, editionsById, editions, filters),
    [baseItems, editions, editionsById, filters, gamesById],
  );
  const selectedEntry = useMemo(
    () => kindItems.find((entry) => entry.id === itemId) ?? null,
    [itemId, kindItems],
  );
  const selectedIsOwn = selectedEntry ? ownEntryIds.has(selectedEntry.id) : false;
  const selectedGame = selectedEntry
    ? gamesById.get(selectedEntry.gameId)
    : undefined;
  const selectedEdition =
    selectedEntry?.editionId ? editionsById.get(selectedEntry.editionId) : undefined;

  useEffect(() => {
    setIsEditing(false);
  }, [itemId]);

  const handleCreated = useCallback(
    (draft: MarketDraft) => {
      const entry = addEntry(draft);
      openItem(entry.id, { replace: true });
    },
    [addEntry, openItem],
  );

  const handleUpdated = useCallback(
    (draft: MarketDraft) => {
      if (!selectedEntry) return;
      updateEntry(selectedEntry.id, draft);
      setIsEditing(false);
    },
    [selectedEntry, updateEntry],
  );

  const handleDelete = useCallback(() => {
    if (!selectedEntry) return;
    removeEntry(selectedEntry.id);
    closePanel();
  }, [closePanel, removeEntry, selectedEntry]);

  const handleSetStatus = useCallback(
    (status: MarketStatus) => {
      if (!selectedEntry) return;
      setEntryStatus(selectedEntry.id, status);
    },
    [selectedEntry, setEntryStatus],
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
        <span className="market-list-hint">
          {showOwn ? 'Ваши лоты, включая проданные и снятые' : copy.hint}
        </span>
        <button
          type="button"
          className={cx('market-own-toggle', showOwn && 'is-active')}
          aria-pressed={showOwn}
          aria-label={showOwn ? 'Показать все лоты' : 'Показать только мои лоты'}
          title={showOwn ? 'Показать все лоты' : 'Показать только мои лоты'}
          onClick={() => setShowOwn((value) => !value)}
        >
          <UserRound size={15} aria-hidden="true" />
          Мои
          {ownCount > 0 && (
            <span className="market-own-toggle__count">{ownCount}</span>
          )}
        </button>
      </div>

      {baseItems.length === 0 ? (
        <div className="market-empty">
          <p>{showOwn ? 'У вас пока нет объявлений в этом разделе.' : copy.empty}</p>
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
              isOwn={ownEntryIds.has(entry.id)}
              onSelect={openItem}
            />
          ))}
        </section>
      )}

      <MarketDrawer
        isOpen={isComposing || selectedEntry !== null}
        isComposing={isComposing}
        isEditing={isEditing}
        isOwn={selectedIsOwn}
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
        onUpdate={handleUpdated}
        onStartEdit={() => setIsEditing(true)}
        onCancelEdit={() => setIsEditing(false)}
        onDelete={handleDelete}
        onSetStatus={handleSetStatus}
        onOpenGame={handleOpenGame}
      />
    </>
  );
}
