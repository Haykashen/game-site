import type { CSSProperties } from 'react';
import type { Game, GameStats } from '../types';
import { GameCard } from './GameCard';

interface GameGridProps {
  games: readonly Game[];
  statsByGame: ReadonlyMap<string, GameStats>;
  onSelectGame: (gameId: string) => void;
  emptyText?: string;
}

const EMPTY_STATE_STYLE: CSSProperties = {
  gridColumn: '1/-1',
  textAlign: 'center',
  color: 'var(--text-muted)',
  padding: '3rem 0',
};

const EMPTY_STATS: GameStats = {
  platforms: [],
  editionCount: 0,
  ownedCount: 0,
  lotsCount: 0,
  coverImage: '',
};

export function GameGrid({
  games,
  statsByGame,
  onSelectGame,
  emptyText = 'Игры не найдены',
}: GameGridProps) {
  return (
    <section className="games-grid" id="gamesGrid">
      {games.length === 0 ? (
        <div style={EMPTY_STATE_STYLE}>{emptyText}</div>
      ) : (
        games.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            stats={statsByGame.get(game.id) ?? EMPTY_STATS}
            onSelect={onSelectGame}
          />
        ))
      )}
    </section>
  );
}
