import { Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { GameBrowser } from '../components/GameBrowser';
import { PageHeading } from '../components/PageHeading';
import { useCollection } from '../context/CollectionContext';

function gamesOnShelf(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) return `${count} игра на полке`;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${count} игры на полке`;
  }

  return `${count} игр на полке`;
}

/** Owned games plus the future achievements slot. */
export function CollectionPage() {
  const { games, ownedIds } = useCollection();

  const ownedGames = useMemo(
    () => games.filter((game) => ownedIds.includes(game.id)),
    [games, ownedIds],
  );

  return (
    <>
      <PageHeading
        eyebrow="MY SHELF / COLLECTION"
        title="Моя коллекция"
        description={
          ownedGames.length > 0
            ? `${gamesOnShelf(ownedGames.length)}. Открывайте карточку, чтобы дополнить издание или снять его с полки.`
            : 'Здесь появятся диски и картриджи, которые вы добавите из каталога.'
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

      <GameBrowser
        games={ownedGames}
        emptyText="В коллекции пока нет игр. Добавьте первую из каталога."
      />
    </>
  );
}
