import {
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  EyeOff,
  Gamepad2,
  Gavel,
  LogIn,
  Pencil,
  RotateCcw,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
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
import { ReportSection } from '../reports/ReportSection';
import { IconButton } from '../ui/IconButton';
import { SpecRow } from '../ui/SpecRow';
import { EntrySubscriptionButton } from './EntrySubscriptionButton';
import { MarketPhotoGallery } from './MarketPhotoGallery';

interface MarketEntryDetailProps {
  entry: MarketEntry;
  game: Game | undefined;
  edition: Edition | undefined;
  titleId: string;
  isOwn: boolean;
  isAuthenticated: boolean;
  onClose: () => void;
  onOpenGame: (gameId: string, editionId?: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetStatus: (status: MarketStatus) => void;
  onPlaceBid: (amount: number) => Promise<string | null>;
  onBuy: () => Promise<string | null>;
}

/** Entity card: the full card of a listing or auction opened from the grid. */
export function MarketEntryDetail({
  entry,
  game,
  edition,
  titleId,
  isOwn,
  isAuthenticated,
  onClose,
  onOpenGame,
  onEdit,
  onDelete,
  onSetStatus,
  onPlaceBid,
  onBuy,
}: MarketEntryDetailProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [tradeError, setTradeError] = useState('');
  const [tradeMessage, setTradeMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAuction = entry.kind === 'auction';
  const isOver = isAuction && isAuctionOver(entry.endsAt);
  const isUpcoming = isAuction && isAuctionUpcoming(entry.startsAt);
  const listingType = isAuction ? null : entry.listingType;
  const minimumBid = entry.bids > 0 ? entry.price + (entry.bidStep ?? 0) : entry.price;
  const canBid =
    isAuction &&
    !isOwn &&
    entry.status === 'active' &&
    !isOver &&
    !isUpcoming;
  const canBuy = !isAuction && !isOwn && entry.status === 'active';
  const buyLabel =
    listingType === 'purchase'
      ? 'Предложить экземпляр'
      : listingType === 'exchange'
        ? 'Предложить обмен'
        : 'Оформить сделку';

  useEffect(() => {
    setBidAmount(String(minimumBid));
    setTradeError('');
  }, [entry.id, minimumBid]);
  const kindLabel = isAuction ? 'Аукцион' : listingTypeLabel(listingType);
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

  const handleBid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAuthenticated) return;

    const amount = Number(bidAmount);

    if (!Number.isSafeInteger(amount) || amount < minimumBid) {
      setTradeError(`Минимальная ставка — ${formatPrice(minimumBid)}.`);
      return;
    }

    setIsSubmitting(true);
    setTradeError('');
    setTradeMessage('');

    const error = await onPlaceBid(amount);

    if (error) {
      setTradeError(error);
    } else {
      setTradeMessage('Ставка принята. Список обновлён.');
    }

    setIsSubmitting(false);
  };

  const handleBuy = async () => {
    if (!isAuthenticated) return;

    setIsSubmitting(true);
    setTradeError('');
    setTradeMessage('');

    const error = await onBuy();

    if (error) {
      setTradeError(error);
    } else {
      setTradeMessage('Сделка создана. Следите за статусом в аккаунте.');
    }

    setIsSubmitting(false);
  };

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

      {!isOwn && (
        <div className="market-subscribe-row">
          <EntrySubscriptionButton entryId={entry.id} />
        </div>
      )}

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
              {entry.moderationStatus && entry.moderationStatus !== 'visible' && (
                <p className="market-form__error">
                  Объявление скрыто модератором и не показывается другим пользователям.
                </p>
              )}
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
                {entry.kind === 'listing' ? (
                  <button
                    type="button"
                    className="btn-secondary market-owner__btn"
                    onClick={() => onSetStatus('sold')}
                  >
                    <CheckCircle2 size={15} aria-hidden="true" />
                    Отметить проданным
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn-secondary market-owner__btn"
                  onClick={() => onSetStatus('closed')}
                >
                  <EyeOff size={15} aria-hidden="true" />
                  {entry.kind === 'auction' ? 'Закрыть аукцион' : 'Снять с продажи'}
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

      {!isOwn && (isAuction || canBuy) && (
        <section className="market-trade" aria-label="Сделка">
          <div className="market-trade__head">
            <div>
              <h4>{isAuction ? 'Ставка' : 'Сделка'}</h4>
              <p className="market-trade__meta">
                {isAuction
                  ? `Минимальная ставка: ${formatPrice(minimumBid)}`
                  : 'Сделка фиксирует цену и открывает отзывы после завершения.'}
              </p>
            </div>
            {isAuction && (
              <span className="meta-chip">{bidsLabel(entry.bids)}</span>
            )}
          </div>

          {!isAuthenticated ? (
            <div className="market-trade__guest">
              <p>Войдите, чтобы участвовать в сделке.</p>
              <Link className="btn-secondary" to="/account">
                <LogIn size={15} aria-hidden="true" />
                Войти в аккаунт
              </Link>
            </div>
          ) : isAuction ? (
            canBid ? (
              <form className="market-trade__form" onSubmit={handleBid}>
                <input
                  type="number"
                  className="form-control"
                  min={minimumBid}
                  step={1}
                  inputMode="numeric"
                  aria-label="Сумма ставки"
                  value={bidAmount}
                  onChange={(event) => setBidAmount(event.target.value)}
                />
                <button
                  type="submit"
                  className="market-form__submit"
                  disabled={isSubmitting}
                >
                  <Gavel size={15} aria-hidden="true" />
                  {isSubmitting ? 'Отправляем…' : 'Сделать ставку'}
                </button>
              </form>
            ) : (
              <p className="market-trade__meta">
                {isUpcoming
                  ? 'Аукцион ещё не начался.'
                  : 'Ставки больше не принимаются.'}
              </p>
            )
          ) : canBuy ? (
            <div className="market-trade__guest">
              <p>Зафиксируйте договорённость — отзыв можно оставить после завершения.</p>
              <button
                type="button"
                className="market-form__submit"
                disabled={isSubmitting}
                onClick={() => void handleBuy()}
              >
                <ShoppingBag size={15} aria-hidden="true" />
                {isSubmitting ? 'Создаём…' : buyLabel}
              </button>
            </div>
          ) : (
            <p className="market-trade__meta">Лот больше недоступен для сделки.</p>
          )}

          {tradeError && (
            <p className="market-form__error" role="alert">
              {tradeError}
            </p>
          )}
          {tradeMessage && <p className="market-form__hint">{tradeMessage}</p>}
          <p className="market-trade__disclaimer">
            DiscVault не принимает оплату и не организует доставку: условия
            обсуждаются напрямую между продавцом и покупателем.
          </p>
        </section>
      )}

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
          <SpecRow
            label="Автор"
            value={
              entry.authorId ? (
                <Link className="spec-link" to={`/users/${entry.authorId}`}>
                  {entry.seller}
                </Link>
              ) : (
                entry.seller
              )
            }
          />
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

      <ReportSection
        key={entry.id}
        targetType="market_entry"
        targetId={entry.id}
        targetLabel={entry.title}
        disabled={isOwn}
      />

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
