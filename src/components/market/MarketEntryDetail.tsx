import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  EyeOff,
  Gamepad2,
  Gavel,
  Pencil,
  RotateCcw,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useState } from 'react';
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
  listingTypeLabel,
} from '../../lib/market';
import { cx } from '../../lib/cx';
import type { Edition, Game, MarketEntry, MarketStatus } from '../../types';
import { IconButton } from '../ui/IconButton';
import { SpecRow } from '../ui/SpecRow';
import { MarketPhotoGallery } from './MarketPhotoGallery';

interface MarketEntryDetailProps {
  entry: MarketEntry;
  game: Game | undefined;
  edition: Edition | undefined;
  titleId: string;
  isOwn: boolean;
  onClose: () => void;
  onOpenGame: (gameId: string, editionId?: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetStatus: (status: MarketStatus) => void;
}

/** Entity card: the full card of a listing or auction opened from the grid. */
export function MarketEntryDetail({
  entry,
  game,
  edition,
  titleId,
  isOwn,
  onClose,
  onOpenGame,
  onEdit,
  onDelete,
  onSetStatus,
}: MarketEntryDetailProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const isAuction = entry.kind === 'auction';
  const isOver = isAuction && isAuctionOver(entry.endsAt);
  const isUpcoming = isAuction && isAuctionUpcoming(entry.startsAt);
  const listingType = isAuction ? null : entry.listingType;
  const kindLabel = isAuction ? 'Аукцион' : listingTypeLabel(listingType);
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
      ? 'Готов купить за'
      : listingType === 'exchange'
        ? 'Оценка'
        : 'Цена';
  const status =
    entry.status === 'sold'
      ? 'Продано'
      : entry.status === 'closed'
        ? 'Снято с продажи'
        : isAuction
          ? isOver
            ? 'Торги завершены'
            : isUpcoming
              ? 'Скоро откроется'
              : 'Идут торги'
          : listingType === 'purchase'
            ? 'Куплю'
            : listingType === 'exchange'
              ? 'Обмен'
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
              <KindIcon size={13} aria-hidden="true" />
              {kindLabel}
            </span>
            <span
              className={cx(
                'meta-chip',
                entry.status !== 'active' &&
                  `market-status-chip market-status-chip--${entry.status}`,
              )}
            >
              {status}
            </span>
          </div>
          <h2 className="modal-title" id={titleId}>
            {entry.title}
          </h2>
        </div>
        <IconButton label="Закрыть" transparent onClick={onClose}>
          <X size={20} />
        </IconButton>
      </div>

      {isOwn && (
        <section className="market-owner" aria-label="Управление объявлением">
          <div className="market-owner__head">
            <div>
              <span className="market-owner__kicker">Ваше объявление</span>
              <p className="market-owner__hint">
                {entry.status === 'active'
                  ? 'Видно всем в разделе. Можно отредактировать, снять или отметить проданным.'
                  : 'Скрыто из общей ленты. Верните в продажу или удалите.'}
              </p>
            </div>
            <span className={cx('market-owner__status', `is-${entry.status}`)}>
              {entry.status === 'active'
                ? 'Активно'
                : entry.status === 'sold'
                  ? 'Продано'
                  : 'Снято'}
            </span>
          </div>

          <div className="market-owner__actions">
            <button type="button" className="btn-secondary market-owner__btn" onClick={onEdit}>
              <Pencil size={15} aria-hidden="true" />
              Редактировать
            </button>

            {entry.status === 'active' ? (
              <>
                <button
                  type="button"
                  className="btn-secondary market-owner__btn"
                  onClick={() => onSetStatus('sold')}
                >
                  <CheckCircle2 size={15} aria-hidden="true" />
                  Отметить проданным
                </button>
                <button
                  type="button"
                  className="btn-secondary market-owner__btn"
                  onClick={() => onSetStatus('closed')}
                >
                  <EyeOff size={15} aria-hidden="true" />
                  Снять с продажи
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn-secondary market-owner__btn"
                onClick={() => onSetStatus('active')}
              >
                <RotateCcw size={15} aria-hidden="true" />
                Вернуть в продажу
              </button>
            )}

            {isConfirmingDelete ? (
              <span className="market-owner__confirm">
                <span>Удалить безвозвратно?</span>
                <button type="button" className="market-owner__danger" onClick={onDelete}>
                  Да, удалить
                </button>
                <button
                  type="button"
                  className="btn-secondary market-owner__btn"
                  onClick={() => setIsConfirmingDelete(false)}
                >
                  Отмена
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="market-owner__delete"
                onClick={() => setIsConfirmingDelete(true)}
              >
                <Trash2 size={15} aria-hidden="true" />
                Удалить
              </button>
            )}
          </div>
        </section>
      )}

      <MarketPhotoGallery photos={entry.photos} title={entry.title} />

      <div className="market-detail-price">
        <div>
          <span className="market-detail-price__label">{priceLabel}</span>
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
          <h4>{isAuction ? 'О лоте' : 'Об объявлении'}</h4>
          <SpecRow label="Игра" value={game?.title ?? '—'} />
          <SpecRow label="Платформа" value={edition?.platform ?? 'Любая'} />
          <SpecRow label="Издание" value={edition?.name ?? 'Любое издание'} />
          <SpecRow label="Регион" value={edition?.region ?? 'Любой'} />
          <SpecRow label="Язык" value={edition?.lang ?? '—'} />
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
              {game.publisher} • {game.year}
            </p>
          </div>
          <button
            type="button"
            className="btn-collection"
            onClick={() => onOpenGame(entry.gameId, entry.editionId ?? undefined)}
          >
            <Gamepad2 size={15} aria-hidden="true" />
            Открыть карточку
          </button>
        </div>
      )}
    </>
  );
}
