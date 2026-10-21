import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { Game } from '../types';
import { GameCard } from './GameCard';

interface GameGridProps {
  games: readonly Game[];
  ownedIds: readonly string[];
  onSelectGame: (gameId: string) => void;
  emptyText?: string;
}

const EMPTY_STATE_STYLE: CSSProperties = {
  gridColumn: '1/-1',
  textAlign: 'center',
  color: 'var(--text-muted)',
  padding: '3rem 0',
};

export function GameGrid({
  games,
  ownedIds,
  onSelectGame,
  emptyText = 'Игры не найдены',
}: GameGridProps) {
  const ownedSet = useMemo(() => new Set(ownedIds), [ownedIds]);

  return (
    <section className="games-grid" id="gamesGrid">
      {games.length === 0 ? (
        <div style={EMPTY_STATE_STYLE}>{emptyText}</div>
      ) : (
        games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            isOwned={ownedSet.has(game.id)}
            onSelect={onSelectGame}
          />
        ))
      )}
    </section>
  );
}
