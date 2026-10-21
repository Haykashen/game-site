import { Clock, Gamepad2, Gavel, Tag, Truck, X } from 'lucide-react';
import { deliveryLabel } from '../../lib/delivery';
import { formatPrice } from '../../lib/formatPrice';
import {
  bidsLabel,
  formatAuctionEnd,
  formatAuctionStart,
  formatMarketDate,
  formatMarketDateTime,
  isAuctionOver,
  isAuctionUpcoming,
} from '../../lib/market';
import { cx } from '../../lib/cx';
import type { Game, MarketEntry } from '../../types';
import { IconButton } from '../ui/IconButton';
import { SpecRow } from '../ui/SpecRow';
import { MarketPhotoGallery } from './MarketPhotoGallery';

interface MarketEntryDetailProps {
  entry: MarketEntry;
  game: Game | undefined;
  titleId: string;
  onClose: () => void;
  onOpenGame: (gameId: string) => void;
}

/** Entity card: the full card of a listing or auction opened from the grid. */
export function MarketEntryDetail({
  entry,
  game,
  titleId,
  onClose,
  onOpenGame,
}: MarketEntryDetailProps) {
  const isAuction = entry.kind === 'auction';
  const isOver = isAuction && isAuctionOver(entry.endsAt);
  const isUpcoming = isAuction && isAuctionUpcoming(entry.startsAt);
  const status = isAuction
    ? isOver
      ? 'Торги завершены'
      : isUpcoming
        ? 'Скоро откроется'
        : 'Идут торги'
    : 'В продаже';
  const auctionTimerLabel = isUpcoming
    ? formatAuctionStart(entry.startsAt)
    : formatAuctionEnd(entry.endsAt);
  const bidStepLabel =
    entry.bidStep === null ? 'Не указан' : formatPrice(entry.bidStep);
  const deliveryServiceLabels = entry.deliveryServices.map(deliveryLabel);
  const internationalShippingLabel =
    entry.internationalShipping === null
      ? 'Не указано'
      : entry.internationalShipping
        ? 'Да'
        : 'Нет';
  const packagingPriceLabel =
    entry.packagingPrice === null
      ? 'Не указана'
      : entry.packagingPrice === 0
        ? 'Бесплатно'
        : formatPrice(entry.packagingPrice);

  return (
    <>
      <div className="modal-header">
        <div>
          <div className="modal-header-meta">
            <span className={cx('market-kind', isAuction && 'market-kind--auction')}>
              {isAuction ? (
                <Gavel size={13} aria-hidden="true" />
              ) : (
                <Tag size={13} aria-hidden="true" />
              )}
              {isAuction ? 'Аукцион' : 'Объявление'}
            </span>
            <span className="meta-chip">{status}</span>
          </div>
          <h2 className="modal-title" id={titleId}>
            {entry.title}
          </h2>
        </div>
        <IconButton label="Закрыть" transparent onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>

      <MarketPhotoGallery photos={entry.photos} title={entry.title} />

      <div className="market-detail-price">
        <div>
          <span className="market-detail-price__label">
            {isAuction ? 'Стартовая ставка' : 'Цена'}
          </span>
          <strong className="market-detail-price__value">{formatPrice(entry.price)}</strong>
        </div>

        {isAuction && (
          <div className="market-detail-price__side">
            <span className="market-detail-price__timer">
              <Clock size={15} aria-hidden="true" />
              {auctionTimerLabel}
            </span>
            <span>{bidsLabel(entry.bids)}</span>
          </div>
        )}
      </div>

      <div className="desc-grid">
        <div className="desc-text">
          <h4>Описание</h4>
          <p>{entry.description}</p>
        </div>

        <div className="spec-box">
          <h4>О лоте</h4>
          <SpecRow label="Игра" value={game?.title ?? '—'} />
          <SpecRow label="Платформа" value={game?.platform ?? '—'} />
          <SpecRow label="Издание" value={entry.edition || game?.edition || '—'} />
          <SpecRow label="Регион" value={entry.region || game?.region || '—'} />
          <SpecRow label="Состояние" value={entry.condition} />
          <SpecRow label="Автор" value={entry.seller} />
          <SpecRow label="Размещено" value={formatMarketDate(entry.createdAt)} />
          {isAuction && <SpecRow label="Шаг цены" value={bidStepLabel} />}
          {isAuction && (
            <SpecRow label="Открытие" value={formatMarketDateTime(entry.startsAt)} />
          )}
          {isAuction && (
            <SpecRow label="Закрытие" value={formatMarketDateTime(entry.endsAt)} />
          )}
          {isAuction && <SpecRow label="Ставок" value={String(entry.bids)} />}
        </div>
      </div>

      <section className="market-shipping" aria-label="Условия доставки">
        <div className="market-shipping__head">
          <span className="market-shipping__icon" aria-hidden="true">
            <Truck size={16} />
          </span>
          <div>
            <h4>Доставка</h4>
            <p>Условия отправки от автора</p>
          </div>
        </div>

        <dl className="market-shipping__grid">
          <div className="market-shipping__item">
            <dt>Службы доставки</dt>
            <dd>
              {deliveryServiceLabels.length > 0 ? (
                <span className="market-shipping__services">
                  {deliveryServiceLabels.map((label) => (
                    <span className="market-shipping__service" key={label}>
                      {label}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="market-shipping__muted">Не указаны</span>
              )}
            </dd>
          </div>

          <div className="market-shipping__item">
            <dt>Доставка в другие страны</dt>
            <dd
              className={cx(
                'market-shipping__value',
                entry.internationalShipping === null && 'market-shipping__muted',
              )}
            >
              {internationalShippingLabel}
            </dd>
          </div>

          <div className="market-shipping__item">
            <dt>Цена упаковки посылки</dt>
            <dd
              className={cx(
                'market-shipping__value',
                entry.packagingPrice === null && 'market-shipping__muted',
              )}
            >
              {packagingPriceLabel}
            </dd>
          </div>

          <div className="market-shipping__item">
            <dt>Откуда отправляет</dt>
            <dd
              className={cx(
                'market-shipping__value',
                !entry.shipsFrom && 'market-shipping__muted',
              )}
            >
              {entry.shipsFrom || 'Не указано'}
            </dd>
          </div>
        </dl>
      </section>

      {game && (
        <div className="market-game-strip">
          <div>
            <span className="market-game-strip__kicker">Игра в каталоге</span>
            <p className="market-game-strip__title">{game.title}</p>
            <p className="market-game-strip__meta">
              {game.publisher} • {game.year} • {game.region}
            </p>
          </div>
          <button
            type="button"
            className="btn-collection"
            onClick={() => onOpenGame(entry.gameId)}
          >
            <Gamepad2 size={15} aria-hidden="true" />
            Открыть карточку
          </button>
        </div>
      )}
    </>
  );
}
