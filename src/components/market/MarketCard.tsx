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
import { marketItemLabel } from '@discvault/shared';
import { ProfileLink } from '../ProfileLink';
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
  const moderationLabel =
    entry.moderationStatus === 'pending'
      ? 'На проверке'
      : entry.moderationStatus === 'hidden' ||
          entry.moderationStatus === 'removed'
        ? 'Скрыто'
        : '';
  const statusLabel =
    entry.status === 'sold' ? 'Продано' : entry.status === 'closed' ? 'Снято' : '';
  const badgeLabel = moderationLabel || statusLabel;
  const badgeClass = moderationLabel
    ? `is-${entry.moderationStatus}`
    : `is-${entry.status}`;
  const KindIcon = isAuction
    ? Gavel
    : listingType === 'purchase'
      ? ShoppingBag
      : listingType === 'exchange'
        ? ArrowLeftRight
        : Tag;
  const priceLabel = isAuction
    ? entry.startPrice !== undefined && entry.bids > 0
      ? 'Текущая ставка'
      : 'Стартовая ставка'
    : listingType === 'purchase'
      ? 'Бюджет'
      : listingType === 'exchange'
        ? 'Оценка'
        : 'Цена';
  const fixedLabel =
    listingType === 'sale' || listingType === null
      ? 'Фиксированная цена'
      : listingTypeLabel(listingType);
  const photo = entry.photos[0];
  const previewImage =
    photo || edition?.coverImages[0] || game?.coverImage || '';
  const hasPhotoCount = entry.photos.length > 1;

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
        (entry.status !== 'active' ||
          entry.moderationStatus === 'hidden' ||
          entry.moderationStatus === 'removed') &&
          'market-card--inactive',
      )}
      role="button"
      tabIndex={0}
      aria-label={`Открыть карточку: ${entry.title}`}
      onClick={() => onSelect(entry.id)}
      onKeyDown={handleKeyDown}
    >
      <div
        className={cx(
          'market-card__media',
          !previewImage && 'market-card__media--art',
        )}
      >
        {previewImage ? (
          <img src={previewImage} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className={cx('card-cover', 'market-card__cover', game && `game-${game.id}`)}>
            <div className="cover-art" aria-hidden="true">
              <span className="art-orbit" />
              <span className="art-sigil" />
              <span className="art-horizon" />
              <span className="art-scanline" />
            </div>
            <div className="card-cover-placeholder">
              <span className="cover-kicker">DISCVAULT / MARKET</span>
              <span className="cover-title">{game?.title ?? entry.title}</span>
              <span className="cover-edition">
                {edition
                  ? `${edition.platform} • ${edition.region}`
                  : game
                    ? [game.publisher, game.year].filter(value => value !== null && value !== '').join(' • ')
                    : entry.condition}
              </span>
            </div>
          </div>
        )}

        {hasPhotoCount && (
          <span className="market-card__photo-count">
            <Images size={12} aria-hidden="true" />
            {entry.photos.length} фото
          </span>
        )}
      </div>

      <div className="market-card__top">
        <span className="market-kind">
          <KindIcon size={13} aria-hidden="true" />
          {kindLabel}
        </span>
        <span className="market-card__top-right">
          {isOwn && <span className="market-card__own">Моё</span>}
          {badgeLabel && (
            <span className={cx('market-card__status', badgeClass)}>
              {badgeLabel}
            </span>
          )}
          <ArrowUpRight className="market-card__arrow" size={17} aria-hidden="true" />
        </span>
      </div>

      <div className="market-card__main">
        <h2 className="market-card__title">{entry.title}</h2>
        <p className="market-card__game">
          {game
            ? `${game.title}${edition ? ` • ${edition.platform} • ${edition.region}` : entry.itemType === 'game' ? ' • любое издание' : ' • отдельный предмет'}`
            : 'Игра не найдена'}
        </p>
      </div>

      <div className="market-card__chips">
        <span className={cx('market-chip', entry.itemType !== 'game' && 'market-chip--loot')}>{marketItemLabel(entry.itemType)}</span>
        {edition && <span className="market-chip">{edition.name}</span>}
        <span className="market-chip">{entry.condition}</span>
        <span className="market-chip"><ProfileLink name={entry.seller} userId={entry.authorId} /></span>
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
