import { Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import shelfArt from '../assets/discvault-shelf.svg';
import { PageHeading } from '../components/PageHeading';
import { CopyCard } from '../components/collection/CopyCard';
import { CopyEditDrawer } from '../components/collection/CopyEditDrawer';
import { useCollection } from '../context/CollectionContext';
import { useAuth } from '../context/AuthContext';
import { ApiState } from '../components/ApiState';
import type { Copy, Edition, Game } from '../types';

interface CopyItem {
  copy: Copy;
  edition: Edition;
  game: Game;
  quantity: number;
  latestAt: number;
  /** Earliest row is the representative, so bulk edits do not flip card text. */
  firstAt: number;
}

function copiesOnShelf(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) return `${count} экземпляр на полке`;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${count} экземпляра на полке`;
  }

  return `${count} экземпляров на полке`;
}

/** Owned copies: every row is a concrete edition, not an abstract game. */
export function CollectionPage() {
  const { user, status } = useAuth();
  const {
    copies,
    editionById,
    games,
    setEditionQuantity,
    updateEdition,
    removeEdition,
    isSyncing,
    syncError,
    isCatalogLoading,
    catalogError,
    refresh,
  } = useCollection();
  const navigate = useNavigate();
  const [editingEditionId, setEditingEditionId] = useState<string | null>(null);

  const gamesById = useMemo(() => new Map(games.map((game) => [game.id, game])), [games]);

  const items = useMemo(() => {
    const byEdition = new Map<string, CopyItem>();

    for (const copy of copies) {
      const edition = editionById.get(copy.editionId);
      if (!edition) continue;

      const game = gamesById.get(edition.gameId);
      if (!game) continue;

      const createdAt = Date.parse(copy.createdAt);
      const existing = byEdition.get(edition.id);

      if (existing) {
        existing.quantity += 1;
        if (createdAt > existing.latestAt) {
          existing.latestAt = createdAt;
        }
        if (createdAt < existing.firstAt) {
          existing.copy = copy;
          existing.firstAt = createdAt;
        }
        continue;
      }

      byEdition.set(edition.id, {
        copy,
        edition,
        game,
        quantity: 1,
        latestAt: createdAt,
        firstAt: createdAt,
      });
    }

    return [...byEdition.values()].sort((a, b) => b.latestAt - a.latestAt);
  }, [copies, editionById, gamesById]);

  const editingItem = editingEditionId
    ? (items.find((item) => item.edition.id === editingEditionId) ?? null)
    : null;

  return (
    <>
      <PageHeading
        eyebrow="MY SHELF / COLLECTION"
        title="Моя коллекция"
        description={
          items.length > 0
            ? `${copiesOnShelf(copies.length)}. Одна карточка — одно издание; количество экземпляров можно менять.`
            : 'Здесь появятся конкретные издания, которые вы добавите из каталога.'
        }
      />

      <ApiState loading={isSyncing || isCatalogLoading} error={syncError ?? catalogError} onRetry={refresh} />
      {status === 'api' && !user && <div className="panel account-notice"><p>Войдите, чтобы увидеть свою коллекцию.</p><Link to="/account" className="btn-secondary">Войти</Link></div>}


      <div className="panel achievements-panel">
        <div className="achievements-icon">
          <Trophy size={22} aria-hidden="true" />
        </div>
        <div className="achievements-copy">
          <p className="panel-title">Достижения</p>
          <p className="panel-hint">
            Награды за серии, регионы и коллекционные издания появятся здесь.
          </p>
        </div>
        <span className="placeholder-chip">Скоро</span>
      </div>

      {items.length === 0 && (isSyncing || isCatalogLoading || syncError || catalogError || !user) ? null : items.length === 0 ? (
        <div className="market-empty collection-empty">
          <figure className="collection-empty__art">
            <img
              src={shelfArt}
              alt="Полка DiscVault с играми для приставок, картриджами и CRT-телевизором"
              width={1600}
              height={1000}
              decoding="async"
            />
          </figure>
          <p>В коллекции пока нет экземпляров. Откройте игру и добавьте нужное издание.</p>
          <Link className="market-compose-btn" to="/games">
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <section className="collection-copy-grid" aria-label="Издания в коллекции">
          {items.map(({ copy, edition, game, quantity }) => (
            <CopyCard
              key={edition.id}
              copy={copy}
              edition={edition}
              game={game}
              quantity={quantity}
              onOpen={() =>
                navigate(
                  `/games?game=${encodeURIComponent(game.id)}&editionId=${encodeURIComponent(edition.id)}`,
                )
              }
              onEdit={() => setEditingEditionId(edition.id)}
              onQuantityChange={(nextQuantity) => setEditionQuantity(edition.id, nextQuantity)}
              onRemove={() => removeEdition(edition.id)}
            />
          ))}
        </section>
      )}

      <CopyEditDrawer
        isOpen={editingItem !== null}
        copy={editingItem?.copy ?? null}
        edition={editingItem?.edition ?? null}
        game={editingItem?.game ?? null}
        quantity={editingItem?.quantity ?? 1}
        onClose={() => setEditingEditionId(null)}
        onSave={async (details) => {
          if (editingItem && await updateEdition(editingItem.edition.id, details)) setEditingEditionId(null);
        }}
      />
    </>
  );
}
