import { StartChatButton } from '../StartChatButton';
import {
  ArrowLeftRight,
  CheckCircle2,
  EyeOff,
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
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { marketItemLabel } from '@discvault/shared';
import { ProfileLink } from '../ProfileLink';
import { deliveryLabel } from '../../lib/delivery';
import { formatPrice } from '../../lib/formatPrice';
import {
  bidsLabel,
  formatMarketCondition,
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
import { DeliveryServiceIcon } from './DeliveryServiceIcon';

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
  onDuplicate: () => void;
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
  onDuplicate,
  onDelete,
  onSetStatus,
  onPlaceBid,
  onBuy,
}: MarketEntryDetailProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const bidInput = useRef<HTMLInputElement>(null);
  const [tradeError, setTradeError] = useState('');
  const [tradeMessage, setTradeMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAuction = entry.kind === 'auction';
  const isPending = entry.moderationStatus === 'pending';
  const isHiddenByModeration =
    entry.moderationStatus === 'hidden' || entry.moderationStatus === 'removed';
  const isPubliclyVisible =
    entry.moderationStatus === undefined || entry.moderationStatus === 'visible';
  const isOver = isAuction && isAuctionOver(entry.endsAt);
  const isUpcoming = isAuction && isAuctionUpcoming(entry.startsAt);
  const listingType = isAuction ? null : entry.listingType;
  const minimumBid = entry.bids > 0 ? entry.price + (entry.bidStep ?? 0) : entry.price;
  const canBid =
    isAuction &&
    !isOwn &&
    isPubliclyVisible &&
    entry.status === 'active' &&
    !isOver &&
    !isUpcoming;
  const canBuy =
    !isAuction && !isOwn && isPubliclyVisible && entry.status === 'active';
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
  const status = entry.moderationStatus === 'draft' ? 'Черновик' : isPending
    ? 'На проверке'
    : isHiddenByModeration
      ? 'Скрыто модератором'
      : entry.status === 'sold'
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
  const bidStepLabel =
    entry.bidStep === null ? 'Не указан' : formatPrice(entry.bidStep);
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
            <span className="meta-chip">{marketItemLabel(entry.itemType)}</span>
            <span
              className={cx(
                'meta-chip',
                (isPending ||
                  isHiddenByModeration ||
                  entry.status !== 'active') &&
                  `market-status-chip market-status-chip--${
                    isPending
                      ? 'pending'
                      : isHiddenByModeration
                        ? entry.moderationStatus
                        : entry.status
                  }`,
              )}
            >
              {status}
            </span>
          </div>
          <h2 className="modal-title" id={titleId}>
            {entry.title}
          </h2>
        </div>
        <div className="market-detail-header-actions">
          {!isOwn && isPubliclyVisible && <EntrySubscriptionButton entryId={entry.id} compact />}
        <IconButton label="Закрыть" transparent onClick={onClose}>
          <X size={20} />
        </IconButton>
        </div>
      </div>

      {isOwn && (
        <section className="market-owner" aria-label="Управление объявлением">
          <div className="market-owner__head">
            <div>
              <span className="market-owner__kicker">Ваше объявление</span>
              <p className="market-owner__hint">
                {entry.moderationStatus === 'draft' ? 'Черновик виден только вам и администрации. Откройте редактирование, чтобы отправить его на проверку.' : isPending
                  ? 'Лот отправлен на проверку. После одобрения администрацией он появится в общей ленте.'
                  : isHiddenByModeration
                    ? 'Объявление скрыто модератором и не показывается другим пользователям.'
                    : entry.status === 'active'
                      ? 'Видно всем в разделе. Можно отредактировать, снять или отметить проданным.'
                      : 'Скрыто из общей ленты. Верните в продажу или удалите.'}
              </p>
              {isPending && (
                <p className="market-form__hint">
                  Пока лот на проверке, другие пользователи не видят его и не
                  могут делать ставки или открывать сделки.
                </p>
              )}
            </div>
            <span
              className={cx(
                'market-owner__status',
                `is-${
                  isPending
                    ? 'pending'
                    : isHiddenByModeration
                      ? entry.moderationStatus
                      : entry.status
                }`,
              )}
            >
              {isPending
                ? 'На проверке'
                : isHiddenByModeration
                  ? 'Скрыто'
                  : entry.status === 'active'
                    ? 'Активно'
                    : entry.status === 'sold'
                      ? 'Продано'
                      : 'Снято'}
            </span>
          </div>

          <div className="market-owner__actions">
            {isActiveAuction(entry) && <><p className="market-owner__hint">Активный лот нельзя редактировать. Создайте новый на основе текущего, а этот закройте или удалите. Данные будут скопированы в новую форму.</p><button type="button" className="btn-secondary market-owner__btn" onClick={onDuplicate}>Создать новый на основе этого</button></>}
            {!isActiveAuction(entry) &&
            <button type="button" className="btn-secondary market-owner__btn" onClick={onEdit}>
              <Pencil size={15} aria-hidden="true" />
              Редактировать
            </button>}

            {!isPending &&
              (entry.status === 'active' ? (
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
                    {entry.kind === 'auction'
                      ? 'Закрыть аукцион'
                      : 'Снять с продажи'}
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
              ))}

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

      <div className="market-detail-overview"><div className="market-detail-overview__media"><MarketPhotoGallery photos={entry.photos} title={entry.title} /></div>
        <div className="spec-box">
          <h4>{isAuction ? 'О лоте' : 'Об объявлении'}</h4>
          <SpecRow label="Игра" value={game ? <button type="button" className="market-game-link" onClick={() => onOpenGame(entry.gameId, entry.editionId ?? undefined)}>{game.title}</button> : '—'} />
          <SpecRow label="Предмет" value={marketItemLabel(entry.itemType)} />
          <SpecRow label="Платформа" value={edition?.platform ?? (entry.itemType === 'game' ? 'Любая' : 'Не указана')} />
          <SpecRow label="Издание" value={edition?.name ?? (entry.itemType === 'game' ? 'Любое издание' : 'Без привязки к изданию')} />
          <SpecRow label="Регион" value={edition?.region ?? 'Любой'} />
          {entry.itemType === 'game' && <SpecRow label="Локализация" value={entry.localization ?? 'Не указано'} />}
          <SpecRow label="Состояние" value={formatMarketCondition(entry.condition)} />
          <SpecRow
            label="Автор"
            value={
              <ProfileLink name={entry.seller} userId={entry.authorId} />
            }
          />
          {!isAuction && <SpecRow label="Размещено" value={formatMarketDate(entry.createdAt)} />}
          {isAuction && <SpecRow label="Шаг цены" value={bidStepLabel} />}
          {isAuction && (
            <SpecRow label="Открытие" value={formatMarketDateTime(entry.startsAt)} />
          )}
          {isAuction && (
            <SpecRow label="Закрытие" value={formatMarketDateTime(entry.endsAt)} />
          )}
          {isAuction && <SpecRow label="Ставок" value={String(entry.bids)} />}
          <SpecRow label={priceLabel} value={<strong className="market-spec-price">{formatPrice(entry.price)}</strong>} />
        </div>
      </div>

      <div className="market-detail-action-bar">

        {!isOwn && isPubliclyVisible && <div className="market-detail-uniform-actions">
          {isAuction && (isAuthenticated ? <button type="button" className="market-form__submit" disabled={!canBid} onClick={() => bidInput.current?.focus()}><Gavel size={16}/>Сделать ставку</button> : <Link className="btn-secondary" to="/account"><Gavel size={16}/>Сделать ставку</Link>)}
          {!isAuction && !canBuy && <button className="market-form__submit" disabled>Сделка недоступна</button>}
          {canBuy && (isAuthenticated ? (<button
                type="button"
                className="market-form__submit"
                disabled={isSubmitting}
                onClick={() => void handleBuy()}
              >
                <ShoppingBag size={15} aria-hidden="true" />
                {isSubmitting ? 'Создаём…' : buyLabel}
              </button>) : <Link className="btn-secondary" to="/account"><ShoppingBag size={15}/>{buyLabel}</Link>)}
          <StartChatButton entryId={entry.id} />
      <ReportSection
        key={entry.id}
        targetType="market_entry"
        targetId={entry.id}
        targetLabel={entry.title}
        disabled={isOwn}
        compact
        showLabel
      />
        </div>}

      </div>

      {!isOwn && isPubliclyVisible && (isAuction || canBuy) && (
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
                  ref={bidInput}
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

      <div className="market-detail-copy">
        <div className="market-detail-info__left"><div className="desc-text"><h4>Описание</h4><p>{entry.description}</p></div>
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
              {entry.deliveryServices.length > 0 ? (
                <span className="market-shipping__services">
                  {entry.deliveryServices.map((service) => (
                    <span className="market-shipping__service" key={service}>
                      <DeliveryServiceIcon service={service} />
                      {deliveryLabel(service)}
                    </span>
                  ))}
                </span>
              ) : (
                <span className="market-shipping__muted">Не указаны</span>
              )}
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
        </div>

      </div>

    </>
  );
}
import { isActiveAuction } from '../../../shared/src/marketLifecycle';
