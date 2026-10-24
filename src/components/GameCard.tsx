import { memo } from 'react';
import type { KeyboardEvent } from 'react';
import { Check, Disc, Eye, Layers } from 'lucide-react';
import { getPlatformBadgeStyle } from '../data';
import { cx } from '../lib/cx';
import { editionsCountLabel, lotsCountLabel } from '../lib/market';
import type { Game, GameStats } from '../types';

interface GameCardProps {
  game: Game;
  stats: GameStats;
  onSelect: (gameId: string) => void;
}

/**
 * Catalogue tile: abstract game first, with edition and market counts in the
 * footer. Memoised so typing in the search field does not re-render every card.
 */
function GameCardComponent({ game, stats, onSelect }: GameCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(game.id);
    }
  };

  const visiblePlatforms = stats.platforms.slice(0, 2);
  const hiddenPlatforms = stats.platforms.length - visiblePlatforms.length;

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
        {stats.coverImage && (
          <img className="card-cover__image" src={stats.coverImage} alt="" loading="lazy" />
        )}

        <div className="cover-art" aria-hidden="true">
          <span className="art-orbit" />
          <span className="art-sigil" />
          <span className="art-horizon" />
          <span className="art-scanline" />
        </div>

        <div className="card-platforms">
          {visiblePlatforms.map((platform) => (
            <span
              key={platform}
              className="badge-platform badge-platform--static"
              data-platform={platform}
              style={getPlatformBadgeStyle(platform)}
            >
              {platform}
            </span>
          ))}
          {hiddenPlatforms > 0 && (
            <span className="badge-platform badge-platform--static badge-platform--more">
              +{hiddenPlatforms}
            </span>
          )}
        </div>

        <div className="card-hover-overlay">
          <span className="overlay-btn">
            <Eye size={14} /> Детали
          </span>
        </div>

        <div className="card-cover-placeholder">
          <span className="cover-kicker">
            {'DISCVAULT '}
            <span className="cover-slash">/</span>
            {' ARCHIVE NO. '}
            <span className="cover-number">{String(game.year).slice(-2)}</span>
          </span>
          <Disc size={40} />
          <span className="cover-title">{game.title}</span>
          <span className="cover-edition">
            {stats.platforms.length > 0 ? stats.platforms.join(' / ') : 'Платформа не указана'} •{' '}
            {game.year}
          </span>
        </div>

        {stats.ownedCount > 0 && (
          <span className="badge-owned">
            <Check size={12} /> На полке
            {stats.ownedCount > 1 ? ` ×${stats.ownedCount}` : ''}
          </span>
        )}
      </div>

      <div className="card-info">
        <div>
          <h3>{game.title}</h3>
          <p className="card-meta">
            {game.publisher} • {game.year}
          </p>
          {game.genres.length > 0 && (
            <p className="card-genres">{game.genres.slice(0, 2).join(' · ')}</p>
          )}
        </div>
        <div className="card-footer">
          <span className="lang-info">
            <Layers size={14} /> {editionsCountLabel(stats.editionCount)}
          </span>
          <span className="lots-count">{lotsCountLabel(stats.lotsCount)}</span>
        </div>
      </div>
    </div>
  );
}

export const GameCard = memo(GameCardComponent);
