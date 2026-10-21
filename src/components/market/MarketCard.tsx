import { ArrowUpRight, Clock, Gavel, Images, Tag } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { formatPrice } from '../../lib/formatPrice';
import {
  bidsLabel,
  formatAuctionEnd,
  formatAuctionStart,
  isAuctionUpcoming,
} from '../../lib/market';
import { cx } from '../../lib/cx';
import type { Game, MarketEntry } from '../../types';

interface MarketCardProps {
  entry: MarketEntry;
  game: Game | undefined;
  onSelect: (entryId: string) => void;
}

/** Entity tile for the listings and auctions pages. */
export function MarketCard({ entry, game, onSelect }: MarketCardProps) {
  const isAuction = entry.kind === 'auction';
  const isUpcoming = isAuction && isAuctionUpcoming(entry.startsAt);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(entry.id);
    }
  };

  return (
    <article
      className={cx('market-card', isAuction && 'market-card--auction')}
      role="button"
      tabIndex={0}
      aria-label={`Открыть карточку: ${entry.title}`}
      onClick={() => onSelect(entry.id)}
      onKeyDown={handleKeyDown}
    >
      {entry.photos.length > 0 && (
        <div className="market-card__media">
          <img src={entry.photos[0]} alt="" loading="lazy" />
          {entry.photos.length > 1 && (
            <span className="market-card__photo-count">
              <Images size={12} aria-hidden="true" />
              {entry.photos.length} фото
            </span>
          )}
        </div>
      )}

      <div className="market-card__top">
        <span className="market-kind">
          {isAuction ? <Gavel size={13} aria-hidden="true" /> : <Tag size={13} aria-hidden="true" />}
          {isAuction ? 'Аукцион' : 'Объявление'}
        </span>
        <ArrowUpRight className="market-card__arrow" size={17} aria-hidden="true" />
      </div>

      <div className="market-card__main">
        <h2 className="market-card__title">{entry.title}</h2>
        <p className="market-card__game">
          {game ? `${game.title} • ${game.platform}` : 'Игра не найдена'}
        </p>
      </div>

      <div className="market-card__chips">
        <span className="market-chip">{entry.condition}</span>
        <span className="market-chip">{entry.seller}</span>
      </div>

      <div className="market-card__bottom">
        <div className="market-card__price-block">
          <span className="market-card__price-label">
            {isAuction ? 'Стартовая ставка' : 'Цена'}
          </span>
          <span className="market-card__price">{formatPrice(entry.price)}</span>
        </div>

        <div className="market-card__timing">
          {isAuction ? (
            <>
              <span className="market-card__end">
                <Clock size={13} aria-hidden="true" />
                {isUpcoming
                  ? formatAuctionStart(entry.startsAt)
                  : formatAuctionEnd(entry.endsAt)}
              </span>
              <span className="market-card__bids">{bidsLabel(entry.bids)}</span>
            </>
          ) : (
            <span className="market-card__fixed">Фиксированная цена</span>
          )}
        </div>
      </div>
    </article>
  );
}
