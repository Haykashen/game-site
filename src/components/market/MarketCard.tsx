import {
  ArrowLeftRight,
  ArrowUpRight,
  Clock,
  Gavel,
  Images,
  ShoppingBag,
  Tag,
} from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { formatPrice } from '../../lib/formatPrice';
import {
  bidsLabel,
  formatAuctionEnd,
  formatAuctionStart,
  isAuctionUpcoming,
  listingTypeLabel,
} from '../../lib/market';
import { cx } from '../../lib/cx';
import type { Edition, Game, MarketEntry } from '../../types';

interface MarketCardProps {
  entry: MarketEntry;
  game: Game | undefined;
  edition?: Edition | undefined;
  isOwn?: boolean;
  onSelect: (entryId: string) => void;
}

/** Entity tile for the listings and auctions pages. */
export function MarketCard({ entry, game, edition, isOwn = false, onSelect }: MarketCardProps) {
  const isAuction = entry.kind === 'auction';
  const isUpcoming = isAuction && isAuctionUpcoming(entry.startsAt);
  const listingType = isAuction ? null : entry.listingType;
  const kindLabel = isAuction ? 'Аукцион' : listingTypeLabel(listingType);
  const statusLabel =
    entry.status === 'sold' ? 'Продано' : entry.status === 'closed' ? 'Снято' : '';
  const KindIcon = isAuction
    ? Gavel
    : listingType === 'purchase'
      ? ShoppingBag
      : listingType === 'exchange'
        ? ArrowLeftRight
        : Tag;
  const priceLabel = isAuction
    ? 'Стартовая ставка'
    : listingType === 'purchase'
      ? 'Бюджет'
      : listingType === 'exchange'
        ? 'Оценка'
        : 'Цена';
  const fixedLabel =
    listingType === 'sale' || listingType === null
      ? 'Фиксированная цена'
      : listingTypeLabel(listingType);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(entry.id);
    }
  };

  return (
    <article
      className={cx(
        'market-card',
        isAuction && 'market-card--auction',
        entry.status !== 'active' && 'market-card--inactive',
      )}
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
          <KindIcon size={13} aria-hidden="true" />
          {kindLabel}
        </span>
        <span className="market-card__top-right">
          {isOwn && <span className="market-card__own">Моё</span>}
          {statusLabel && (
            <span className={cx('market-card__status', `is-${entry.status}`)}>
              {statusLabel}
            </span>
          )}
          <ArrowUpRight className="market-card__arrow" size={17} aria-hidden="true" />
        </span>
      </div>

      <div className="market-card__main">
        <h2 className="market-card__title">{entry.title}</h2>
        <p className="market-card__game">
          {game
            ? `${game.title}${edition ? ` • ${edition.platform} • ${edition.region}` : ' • любое издание'}`
            : 'Игра не найдена'}
        </p>
      </div>

      <div className="market-card__chips">
        {edition && <span className="market-chip">{edition.name}</span>}
        <span className="market-chip">{entry.condition}</span>
        <span className="market-chip">{entry.seller}</span>
      </div>

      <div className="market-card__bottom">
        <div className="market-card__price-block">
          <span className="market-card__price-label">{priceLabel}</span>
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
            <span className="market-card__fixed">{fixedLabel}</span>
          )}
        </div>
      </div>
    </article>
  );
}
