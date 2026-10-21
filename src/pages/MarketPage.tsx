import { Plus } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { MarketCard } from '../components/market/MarketCard';
import { MarketDrawer } from '../components/market/MarketDrawer';
import { useCollection } from '../context/CollectionContext';
import { useMarketEntries } from '../hooks/useMarketEntries';
import { useMarketPanelParam } from '../hooks/useMarketPanelParam';
import { marketCountLabel } from '../lib/market';
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
}

const COPY: Record<MarketKind, MarketCopy> = {
  listing: {
    eyebrow: 'MARKET / LISTINGS',
    title: 'Объявления',
    description: 'Продажа, покупка и обмен изданиями между коллекционерами.',
    cta: 'Разместить объявление',
    hint: 'Фиксированные цены и прямые предложения',
    empty: 'Объявлений пока нет — разместите первое.',
  },
  auction: {
    eyebrow: 'MARKET / AUCTIONS',
    title: 'Аукционы',
    description: 'Торги за редкие издания: ставки и время до закрытия лота.',
    cta: 'Разместить аукцион',
    hint: 'Ставки принимаются до окончания таймера',
    empty: 'Аукционов пока нет — запустите первый.',
  },
};

/** Shared marketplace page: entity grid, placement CTA and the URL-driven drawer. */
export function MarketPage({ kind }: MarketPageProps) {
  const copy = COPY[kind];
  const navigate = useNavigate();
  const { games } = useCollection();
  const { entries, addEntry } = useMarketEntries();
  const {
    isComposing,
    composeGameId,
    itemId,
    openCompose,
    openItem,
    closePanel,
  } = useMarketPanelParam();

  const gamesById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);
  const items = useMemo(() => entries.filter((entry) => entry.kind === kind), [entries, kind]);
  const selectedEntry = useMemo(
    () => items.find((entry) => entry.id === itemId) ?? null,
    [items, itemId],
  );
  const selectedGame = selectedEntry
    ? gamesById.get(selectedEntry.gameId)
    : undefined;

  const handleCreated = useCallback(
    (draft: MarketDraft) => {
      const entry = addEntry(draft);
      openItem(entry.id, { replace: true });
    },
    [addEntry, openItem],
  );

  const handleOpenGame = useCallback(
    (gameId: string) => {
      navigate(`/games?game=${encodeURIComponent(gameId)}`);
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

      <div className="market-list-head">
        <span className="market-count">{marketCountLabel(items.length, kind)}</span>
        <span className="market-list-hint">{copy.hint}</span>
      </div>

      {items.length === 0 ? (
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
      ) : (
        <section className="market-grid" aria-label={copy.title}>
          {items.map((entry) => (
            <MarketCard
              key={entry.id}
              entry={entry}
              game={gamesById.get(entry.gameId)}
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
        games={games}
        initialGameId={composeGameId}
        onClose={closePanel}
        onCreate={handleCreated}
        onOpenGame={handleOpenGame}
      />
    </>
  );
}
