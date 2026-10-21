import { memo } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, Disc, Eye, Languages } from 'lucide-react';
import { getPlatformBadgeStyle } from '../data';
import { cx } from '../lib/cx';
import type { Game } from '../types';

interface GameCardProps {
  game: Game;
  isOwned: boolean;
  onSelect: (gameId: string) => void;
}

/**
 * Catalogue tile: generated cover art, badges and a compact meta footer.
 * Memoised so typing in the search field does not re-render every card.
 */
function GameCardComponent({ game, isOwned, onSelect }: GameCardProps) {
  const salesLotsCount = game.lots.filter((lot) => lot.type === 'sale').length;
  const platformStyle = getPlatformBadgeStyle(game.platform);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(game.id);
    }
  };

  return (
    <div
      className={cx('game-card', `game-${game.id}`)}
      role="button"
      tabIndex={0}
      aria-label={`Открыть карточку ${game.title}`}
      onClick={() => onSelect(game.id)}
      onKeyDown={handleKeyDown}
    >
      <div className="card-cover">
        <div className="cover-art" aria-hidden="true">
          <span className="art-orbit" />
          <span className="art-sigil" />
          <span className="art-horizon" />
          <span className="art-scanline" />
        </div>

        <div className="card-hover-overlay">
          <span className="overlay-btn">
            <Eye size={14} /> Детали
          </span>
        </div>

        <div className="card-cover-placeholder">
          <span className="cover-kicker">
            {'RETROKEEP '}
            <span className="cover-slash">/</span>
            {' ARCHIVE NO. '}
            <span className="cover-number">{String(game.year).slice(-2)}</span>
          </span>
          <Disc size={40} />
          <span className="cover-title">{game.title}</span>
          <span className="cover-edition">
            {game.platform} • {game.year}
          </span>
        </div>

        <span className="badge-platform" data-platform={game.platform} style={platformStyle}>
          {game.platform}
        </span>
        {isOwned && (
          <span className="badge-owned">
            <Check size={12} /> На полке
          </span>
        )}
      </div>

      <div className="card-info">
        <div>
          <h3>{game.title}</h3>
          <p className="card-meta">
            {game.publisher} • {game.year}
          </p>
        </div>
        <div className="card-footer">
          <span className="lang-info">
            <Languages size={14} /> {game.lang}
          </span>
          <span className="lots-count">{salesLotsCount} лотов</span>
        </div>
      </div>
    </div>
  );
}

export const GameCard = memo(GameCardComponent);
