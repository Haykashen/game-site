import { MessageSquare } from 'lucide-react';
import { editionLabel } from '../../lib/editions';
import type { Edition, Game, MarketEntry } from '../../types';
import { MarketCard } from '../market/MarketCard';
import { Tabs } from '../ui/Tabs';

export type GameMarketTab = 'lots' | 'sale-purchase' | 'exchange' | 'discussions';

interface GameMarketSectionProps {
  game: Game;
  entries: readonly MarketEntry[];
  editions: readonly Edition[];
  selectedEditionId: string;
  onChangeEdition: (editionId: string) => void;
  activeTab: GameMarketTab;
  onChangeTab: (tab: GameMarketTab) => void;
  onOpenEntry: (entry: MarketEntry) => void;
}

const TAB_ITEMS: ReadonlyArray<{ id: GameMarketTab; label: string }> = [
  { id: 'lots', label: 'Лоты' },
  { id: 'sale-purchase', label: 'Продажи и Покупки' },
  { id: 'exchange', label: 'Обмен' },
  { id: 'discussions', label: 'Обсуждения' },
];

/** Game-scoped marketplace: auction lots, listings and the discussions slot. */
export function GameMarketSection({
  game,
  entries,
  editions,
  selectedEditionId,
  onChangeEdition,
  activeTab,
  onChangeTab,
  onOpenEntry,
}: GameMarketSectionProps) {
  const editionById = new Map(editions.map((edition) => [edition.id, edition]));
  const gameEntries = entries.filter((entry) => entry.gameId === game.id);
  const scopedEntries = selectedEditionId
    ? gameEntries.filter((entry) => entry.editionId === selectedEditionId)
    : gameEntries;
  const auctionLots = scopedEntries.filter((entry) => entry.kind === 'auction');
  const salePurchaseListings = scopedEntries.filter(
    (entry) =>
      entry.kind === 'listing' &&
      (entry.listingType === 'sale' || entry.listingType === 'purchase'),
  );
  const exchangeListings = scopedEntries.filter(
    (entry) => entry.kind === 'listing' && entry.listingType === 'exchange',
  );
  const visibleEntries =
    activeTab === 'lots'
      ? auctionLots
      : activeTab === 'sale-purchase'
        ? salePurchaseListings
        : activeTab === 'exchange'
          ? exchangeListings
          : [];
  const items = TAB_ITEMS.map((item) => {
    const count =
      item.id === 'lots'
        ? auctionLots.length
        : item.id === 'sale-purchase'
          ? salePurchaseListings.length
          : item.id === 'exchange'
            ? exchangeListings.length
            : null;

    return {
      ...item,
      label: count === null ? item.label : `${item.label} (${count})`,
    };
  });
  const emptyText =
    activeTab === 'lots'
      ? 'Активных лотов по этому изданию пока нет.'
      : activeTab === 'sale-purchase'
        ? 'Объявлений о продаже и покупке пока нет.'
        : 'Обменных объявлений пока нет.';

  return (
    <section className="game-market" aria-label="Маркет по игре">
      <div className="game-market__filter">
        <label className="game-market__filter-label" htmlFor="gameMarketEdition">
          Издание
        </label>
        <select
          id="gameMarketEdition"
          className="form-control game-market__select"
          value={selectedEditionId}
          onChange={(event) => onChangeEdition(event.target.value)}
        >
          <option value="">Все издания ({editions.length})</option>
          {editions.map((edition) => (
            <option key={edition.id} value={edition.id}>
              {editionLabel(edition)}
            </option>
          ))}
        </select>
      </div>

      <Tabs
        items={items}
        value={activeTab}
        onChange={onChangeTab}
        containerClassName="tabs-header game-market__tabs"
        buttonClassName="tab-btn"
        ariaLabel="Маркет по игре"
      />

      {activeTab === 'discussions' ? (
        <div className="game-market__empty game-market__empty--discussions">
          <MessageSquare size={22} aria-hidden="true" />
          <p>Обсуждений пока нет.</p>
          <span className="game-market__soon">Скоро</span>
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="game-market__empty">
          <p>{emptyText}</p>
        </div>
      ) : (
        <div className="game-market__grid">
          {visibleEntries.map((entry) => (
            <MarketCard
              key={entry.id}
              entry={entry}
              game={game}
              edition={entry.editionId ? editionById.get(entry.editionId) : undefined}
              onSelect={() => onOpenEntry(entry)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
