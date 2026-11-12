import { PlatformBadge } from './ui/PlatformBadge';
import { CollectionCountBadge } from './ui/CollectionCountBadge';
import { Link } from 'react-router-dom';
import { memo } from 'react';
import { FallbackImage } from './FallbackImage';
import type { KeyboardEvent } from 'react';
import { Disc, Eye } from 'lucide-react';
import { sortPlatforms } from '../data/reference';
import { NAV_ITEMS } from '../app/navigation';
import { cx } from '../lib/cx';
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
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(game.id);
    }
  };

  const platforms = sortPlatforms(stats.platforms);
  const visiblePlatforms = platforms.slice(0, 2);
  const hiddenPlatforms = platforms.length - visiblePlatforms.length;
  const marketStats = [
    { section: NAV_ITEMS.auctions, count: stats.lotsCount },
    { section: NAV_ITEMS.sales, count: stats.salesCount },
    { section: NAV_ITEMS.purchases, count: stats.purchasesCount },
    { section: NAV_ITEMS.exchange, count: stats.exchangeCount },
  ];

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
          <FallbackImage className="card-cover__image" images={stats.coverImages ?? [stats.coverImage]} alt="" loading="lazy" />
        )}

        <div className="cover-art" aria-hidden="true">
          <span className="art-orbit" />
          <span className="art-sigil" />
          <span className="art-horizon" />
          <span className="art-scanline" />
        </div>

        <div className="card-platforms">
          {visiblePlatforms.map((platform) => (
            <PlatformBadge key={platform} platform={platform} />
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
            <span className="cover-number">{game.year === null ? '—' : String(game.year).slice(-2)}</span>
          </span>
          <Disc size={40} />
          <span className="cover-title">{game.title}</span>
          <span className="cover-edition">
            {platforms.length > 0 ? platforms.join(' / ') : 'Платформа не указана'} •{' '}
            {game.year ?? 'Год не указан'}
          </span>
        </div>

        <CollectionCountBadge count={stats.ownedCount} />
      </div>

      <div className="card-info">
        <div>
          <h3 title={game.title}>{game.title}</h3>
          <p className="card-meta">
            {[game.year, game.developer].filter(value => value !== null && value !== '').join(' • ') || 'Сведения об игре уточняются'}
          </p>
        </div>
        <div className="card-footer">
          <div className="card-market-stats" aria-label="Активные предложения по игре">
            {marketStats.map(({ section, count }) => {
              const Icon = section.icon;
              const label = `${section.label}: ${count}`;
              return (
                <Link to={`${section.path}?gameFilter=${encodeURIComponent(game.id)}`} onClick={event => event.stopPropagation()} key={section.id} className={cx('card-market-stat', `card-market-stat--${section.id}`, count === 0 && 'card-market-stat--empty')}
                  aria-label={`${section.label} по игре ${game.title}: ${count}`} title={label}>
                  <Icon size={14} aria-hidden="true" />
                  <span className="card-market-stat__count" aria-hidden="true">{count}</span><span className="card-market-stat__label">{section.id === 'auctions' ? 'Лоты' : section.id === 'exchange' ? 'Обмены' : section.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export const GameCard = memo(GameCardComponent);
