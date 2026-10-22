import { Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeading } from '../components/PageHeading';
import { CopyCard } from '../components/collection/CopyCard';
import { useCollection } from '../context/CollectionContext';
import type { Copy, Edition, Game } from '../types';

interface CopyItem {
  copy: Copy;
  edition: Edition;
  game: Game;
  quantity: number;
  latestAt: number;
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
  const { copies, editionById, games, setEditionQuantity, removeEdition } = useCollection();
  const navigate = useNavigate();

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
          existing.copy = copy;
          existing.latestAt = createdAt;
        }
        continue;
      }

      byEdition.set(edition.id, {
        copy,
        edition,
        game,
        quantity: 1,
        latestAt: createdAt,
      });
    }

    return [...byEdition.values()].sort((a, b) => b.latestAt - a.latestAt);
  }, [copies, editionById, gamesById]);

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

      {items.length === 0 ? (
        <div className="market-empty collection-empty">
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
              onQuantityChange={(nextQuantity) => setEditionQuantity(edition.id, nextQuantity)}
              onRemove={() => removeEdition(edition.id)}
            />
          ))}
        </section>
      )}
    </>
  );
}
