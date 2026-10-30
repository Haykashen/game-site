import { Plus, RotateCcw, UserRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { SearchToolbar } from '../components/SearchToolbar';
import { MarketCard } from '../components/market/MarketCard';
import { MarketDrawer } from '../components/market/MarketDrawer';
import { useAuth } from '../context/AuthContext';
import { ApiState } from '../components/ApiState';
import { useCollection } from '../context/CollectionContext';
import { useMarketEntries } from '../hooks/useMarketEntries';
import { useMarketPanelParam } from '../hooks/useMarketPanelParam';
import { useUrlFilters } from '../hooks/useUrlFilters';
import { cx } from '../lib/cx';
import { marketCountLabel } from '../lib/market';
import { SEARCH_FILTER_PARAMS } from '../lib/searchFilterConfig';
import { useSearchFields } from '../hooks/useSearchFields';
import { selectVisibleMarketEntries } from '../lib/selectVisibleMarketEntries';
import type {
  MarketDraft,
  MarketKind,
  MarketListingType,
  MarketStatus,
} from '../types';

interface MarketPageProps {
  kind: MarketKind;
  /** When set, only listings with this intention are shown. */
  listingType?: MarketListingType | undefined;
}

interface MarketCopy {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  hint: string;
  ownLabel: string;
  empty: string;
  searchPlaceholder: string;
  filteredEmpty: string;
}

const COPY: Record<MarketKind | MarketListingType, MarketCopy> = {
  listing: {
    eyebrow: 'MARKET / LISTINGS',
    title: 'Объявления',
    description: 'Продажа, покупка и обмен играми и лутом между коллекционерами.',
    cta: 'Разместить объявление',
    hint: 'Фиксированные цены и прямые предложения',
    ownLabel: 'Мои объявления',
    empty: 'Объявлений пока нет — разместите первое.',
    searchPlaceholder: 'Найти объявление, игру или продавца',
    filteredEmpty: 'По выбранным фильтрам объявлений не найдено.',
  },
  sale: {
    eyebrow: 'MARKET / SALES',
    title: 'Продажи',
    description: 'Игры, издания и лут для вашей коллекции.',
    cta: 'Разместить продажу',
    hint: 'Фиксированные цены и прямые предложения',
    ownLabel: 'Мои продажи',
    empty: 'Продаж пока нет — разместите первое объявление.',
    searchPlaceholder: 'Найти продажу, игру или продавца',
    filteredEmpty: 'По выбранным фильтрам продаж не найдено.',
  },
  purchase: {
    eyebrow: 'MARKET / PURCHASES',
    title: 'Покупки',
    description: 'Запросы на покупку игр и лута: найдите нужный предмет или предложите свой.',
    cta: 'Разместить покупку',
    hint: 'Игры, издания и отдельные предметы',
    ownLabel: 'Мои покупки',
    empty: 'Покупок пока нет — разместите первый запрос.',
    searchPlaceholder: 'Найти покупку, игру или покупателя',
    filteredEmpty: 'По выбранным фильтрам покупок не найдено.',
  },
  exchange: {
    eyebrow: 'MARKET / EXCHANGE',
    title: 'Обмен',
    description: 'Обмен играми и лутом между коллекционерами.',
    cta: 'Предложить обмен',
    hint: 'Прямой обмен играми и лутом по договорённости',
    ownLabel: 'Мои обмены',
    empty: 'Обменных предложений пока нет — разместите первое.',
    searchPlaceholder: 'Найти обмен, игру или коллекционера',
    filteredEmpty: 'По выбранным фильтрам обменов не найдено.',
  },
  auction: {
    eyebrow: 'MARKET / AUCTIONS',
    title: 'Аукционы',
    description: 'Торги за игры, редкие издания и лут: ставки и время до закрытия лота.',
    cta: 'Разместить аукцион',
    hint: 'Ставки принимаются до окончания таймера',
    ownLabel: 'Мои лоты',
    empty: 'Аукционов пока нет — запустите первый.',
    searchPlaceholder: 'Найти аукцион, игру или продавца',
    filteredEmpty: 'По выбранным фильтрам аукционов не найдено.',
  },
};

/** Shared marketplace page: search/filters, entity grid, CTA and URL drawer. */
export function MarketPage({ kind, listingType }: MarketPageProps) {
  const fields = useSearchFields('market');
  const selectedListingType = kind === 'listing' ? listingType : undefined;
  const copyKey: MarketKind | MarketListingType =
    kind === 'listing' ? (selectedListingType ?? 'listing') : kind;
  const copy = COPY[copyKey];
  const navigate = useNavigate();
  const [marketParams, setMarketParams] = useSearchParams();
  const gameFilter = marketParams.get('gameFilter') ?? '';
  const { user } = useAuth();
  const { games, editions } = useCollection();
  const {
    entries,
    ownEntryIds,
    addEntry,
    updateEntry,
    removeEntry,
    setEntryStatus,
    placeBid,
    purchase,
    error: marketError,
    isLoading,
    refresh,
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
    () => entries.filter((entry) => entry.kind === kind && (!gameFilter || entry.gameId === gameFilter)),
    [entries, kind, gameFilter],
  );
  const scopedItems = useMemo(
    () =>
      selectedListingType
        ? kindItems.filter((entry) => entry.listingType === selectedListingType)
        : kindItems,
    [kindItems, selectedListingType],
  );
  const ownCount = useMemo(
    () => scopedItems.filter((entry) => ownEntryIds.has(entry.id)).length,
    [scopedItems, ownEntryIds],
  );
  const baseItems = useMemo(
    () =>
      scopedItems.filter((entry) =>
        showOwn
          ? ownEntryIds.has(entry.id)
          : entry.status === 'active' &&
            (entry.moderationStatus === undefined ||
              entry.moderationStatus === 'visible'),
      ),
    [scopedItems, ownEntryIds, showOwn],
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
    async (draft: MarketDraft) => {
      const entry = await addEntry(draft);
      if (entry) openItem(entry.id, { replace: true });
    },
    [addEntry, openItem],
  );

  const handleUpdated = useCallback(
    async (draft: MarketDraft) => {
      if (!selectedEntry) return;
      const updated = await updateEntry(selectedEntry.id, draft);
      if (updated) setIsEditing(false);
    },
    [selectedEntry, updateEntry],
  );

  const handleDelete = useCallback(async () => {
    if (!selectedEntry) return;
    if (await removeEntry(selectedEntry.id)) closePanel();
  }, [closePanel, removeEntry, selectedEntry]);

  const handleSetStatus = useCallback(
    async (status: MarketStatus) => {
      if (!selectedEntry) return;
      await setEntryStatus(selectedEntry.id, status);
    },
    [selectedEntry, setEntryStatus],
  );

  const handlePlaceBid = useCallback(
    async (amount: number) => {
      if (!selectedEntry) return 'Лот не найден.';
      return placeBid(selectedEntry.id, amount);
    },
    [placeBid, selectedEntry],
  );

  const handleBuy = useCallback(async () => {
    if (!selectedEntry) return 'Лот не найден.';
    return purchase(selectedEntry.id);
  }, [purchase, selectedEntry]);

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
      />



      <SearchToolbar
        key={copyKey}
        idPrefix={copyKey}
        ariaLabel={`Поиск и фильтры: ${copy.title}`}
        searchPlaceholder={copy.searchPlaceholder}
        query={filters.query}
        filterValues={filters}
        fields={fields}
        resultCountLabel={marketCountLabel(
          visibleItems.length,
          kind,
          selectedListingType,
        )}
        onQueryChange={(query) => setValue('query', query)}
        onFilterChange={setValue}
        onReset={resetFilters}
        hint={showOwn ? `${copy.ownLabel}, включая проданные и снятые` : copy.hint}
        leadingActions={
          <button
            type="button"
            className={cx(
              'filter-icon-btn',
              'market-own-toggle',
              showOwn && 'is-active',
            )}
            aria-pressed={showOwn}
            aria-label={copy.ownLabel}
            title={copy.ownLabel}
            onClick={() => setShowOwn((value) => !value)}
          >
            <UserRound size={17} aria-hidden="true" />
            {ownCount > 0 && (
              <span
                className="filter-toggle__count market-own-toggle__count"
                aria-hidden="true"
              >
                {ownCount}
              </span>
            )}
          </button>
        }
        actions={
          <button
            type="button"
            className="market-compose-btn market-compose-btn--toolbar"
            onClick={() => openCompose()}
          >
            <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
            {copy.cta}
          </button>
        }
      />

      {gameFilter && <p className="market-game-filter">Игра: {gamesById.get(gameFilter)?.title ?? 'Выбранная игра'} <button type="button" className="btn-secondary" onClick={() => setMarketParams(previous => {const next = new URLSearchParams(previous);next.delete('gameFilter');return next;})}>Снять фильтр</button></p>}
      <ApiState loading={isLoading} error={marketError} onRetry={refresh} />
      {isLoading || marketError ? null : baseItems.length === 0 ? (
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
        error={marketError}
        isOpen={isComposing || selectedEntry !== null}
        isComposing={isComposing}
        isEditing={isEditing}
        isOwn={selectedIsOwn}
        isAuthenticated={Boolean(user)}
        kind={kind}
        initialListingType={selectedListingType}
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
        onPlaceBid={handlePlaceBid}
        onBuy={handleBuy}
        onOpenGame={handleOpenGame}
      />
    </>
  );
}
