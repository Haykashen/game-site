import { Gavel, Tag, X } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { cx } from '../../lib/cx';
import { DELIVERY_SERVICES } from '../../lib/delivery';
import { editionLabel } from '../../lib/editions';
import { MARKET_LISTING_TYPE_OPTIONS } from '../../lib/market';
import type {
  Edition,
  Game,
  MarketDeliveryService,
  MarketDraft,
  MarketEntry,
  MarketKind,
  MarketListingType,
} from '../../types';
import { FormField } from '../ui/FormField';
import { IconButton } from '../ui/IconButton';
import { PhotoPicker } from './PhotoPicker';

interface ComposeEntryFormProps {
  kind: MarketKind;
  games: readonly Game[];
  editions: readonly Edition[];
  /** Game preselected when the flow started from a game card. */
  initialGameId: string;
  /** Edition preselected when the flow started from an edition card. */
  initialEditionId: string;
  /** When present, the form edits this entry instead of creating a new one. */
  entry?: MarketEntry;
  titleId: string;
  onSubmit: (draft: MarketDraft) => void;
  onCancel: () => void;
}

const DEFAULT_AUCTION_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
/** There is no sign-in yet, so the author of every local entry is the current user. */
const AUTHOR = 'Вы';

function formatDateTimeLocal(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('');
}

/** The placement card: a compact form for a new listing or auction. */
export function ComposeEntryForm({
  kind,
  games,
  editions,
  initialGameId,
  initialEditionId,
  entry,
  titleId,
  onSubmit,
  onCancel,
}: ComposeEntryFormProps) {
  const isEditing = Boolean(entry);
  const formKind = entry?.kind ?? kind;
  const isAuction = formKind === 'auction';
  const editingGameId =
    entry && games.some((game) => game.id === entry.gameId) ? entry.gameId : '';
  const defaultGameId =
    editingGameId ||
    (games.some((game) => game.id === initialGameId)
      ? initialGameId
      : (games[0]?.id ?? ''));

  const editionsForGame = (gameId: string) => editions.filter((edition) => edition.gameId === gameId);

  const defaultEditionId = (gameId: string) => {
    const gameEditions = editionsForGame(gameId);
    const preferred = gameEditions.find((edition) => edition.id === initialEditionId);
    return preferred?.id ?? gameEditions[0]?.id ?? '';
  };

  const [gameId, setGameId] = useState(defaultGameId);
  const [listingType, setListingType] = useState<MarketListingType>(
    entry?.listingType ?? 'sale',
  );
  const [editionId, setEditionId] = useState(() =>
    entry ? (entry.editionId ?? '') : defaultEditionId(defaultGameId),
  );
  const [title, setTitle] = useState(entry?.title ?? '');
  const [condition, setCondition] = useState(entry?.condition ?? '');
  const [price, setPrice] = useState(entry ? String(entry.price) : '');
  const [bidStep, setBidStep] = useState(
    entry?.bidStep !== null && entry?.bidStep !== undefined ? String(entry.bidStep) : '100',
  );
  const [startsAt, setStartsAt] = useState(() =>
    entry?.startsAt
      ? formatDateTimeLocal(new Date(entry.startsAt))
      : formatDateTimeLocal(new Date()),
  );
  const [endsAt, setEndsAt] = useState(() =>
    entry?.endsAt
      ? formatDateTimeLocal(new Date(entry.endsAt))
      : formatDateTimeLocal(new Date(Date.now() + DEFAULT_AUCTION_DAYS * DAY_MS)),
  );
  const [auctionTimeError, setAuctionTimeError] = useState('');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [photos, setPhotos] = useState<string[]>(entry ? [...entry.photos] : []);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [deliveryServices, setDeliveryServices] = useState<MarketDeliveryService[]>(
    entry ? [...entry.deliveryServices] : [],
  );
  const [deliveryError, setDeliveryError] = useState('');
  const [internationalShipping, setInternationalShipping] = useState(
    entry?.internationalShipping ?? false,
  );
  const [packagingPrice, setPackagingPrice] = useState(
    entry?.packagingPrice !== null && entry?.packagingPrice !== undefined
      ? String(entry.packagingPrice)
      : '',
  );
  const [shipsFrom, setShipsFrom] = useState(entry?.shipsFrom ?? '');

  const gameEditions = editionsForGame(gameId);
  const selectedGame = games.find((game) => game.id === gameId);
  const isPurchase = !isAuction && listingType === 'purchase';

  const handleGameChange = (nextGameId: string) => {
    setGameId(nextGameId);
    setEditionId(defaultEditionId(nextGameId));
  };

  const handleListingTypeChange = (nextType: MarketListingType) => {
    setListingType(nextType);

    if (nextType !== 'purchase' && !editionId) {
      setEditionId(editionsForGame(gameId)[0]?.id ?? '');
    }
  };

  const toggleDeliveryService = (service: MarketDeliveryService) => {
    setDeliveryServices((current) =>
      current.includes(service)
        ? current.filter((value) => value !== service)
        : [...current, service],
    );
    setDeliveryError('');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isProcessingPhotos) return;

    const trimmedTitle = title.trim();
    const trimmedEditionId = editionId.trim();
    const trimmedCondition = condition.trim();
    const trimmedDescription = description.trim();
    const trimmedShipsFrom = shipsFrom.trim();
    const numericPrice = Number(price);
    const numericBidStep = bidStep.trim() === '' ? null : Number(bidStep);
    const numericPackaging =
      packagingPrice.trim() === '' ? null : Number(packagingPrice);
    const startTimestamp = Date.parse(startsAt);
    const endTimestamp = Date.parse(endsAt);

    if (
      !gameId ||
      !trimmedTitle ||
      !trimmedCondition ||
      !trimmedDescription ||
      !trimmedShipsFrom ||
      !Number.isInteger(numericPrice) ||
      numericPrice <= 0 ||
      (isAuction &&
        (numericBidStep === null ||
          !Number.isInteger(numericBidStep) ||
          numericBidStep <= 0)) ||
      (numericPackaging !== null &&
        (!Number.isInteger(numericPackaging) || numericPackaging < 0))
    ) {
      return;
    }

    if (!isPurchase && !trimmedEditionId) return;
    if (trimmedEditionId && !gameEditions.some((edition) => edition.id === trimmedEditionId)) {
      return;
    }

    if (
      isAuction &&
      (!Number.isFinite(startTimestamp) ||
        !Number.isFinite(endTimestamp) ||
        endTimestamp <= startTimestamp)
    ) {
      setAuctionTimeError('Дата закрытия должна быть позже даты открытия.');
      return;
    }

    if (deliveryServices.length === 0) {
      setDeliveryError('Выберите хотя бы одну службу доставки.');
      return;
    }

    onSubmit({
      kind: formKind,
      listingType: isAuction ? null : listingType,
      gameId,
      editionId: trimmedEditionId || null,
      title: trimmedTitle,
      condition: trimmedCondition,
      price: numericPrice,
      seller: entry?.seller ?? AUTHOR,
      description: trimmedDescription,
      photos,
      deliveryServices,
      internationalShipping,
      packagingPrice: numericPackaging,
      shipsFrom: trimmedShipsFrom,
      bidStep: isAuction ? numericBidStep : null,
      startsAt: isAuction ? new Date(startTimestamp).toISOString() : null,
      endsAt: isAuction ? new Date(endTimestamp).toISOString() : null,
    });
  };

  return (
    <>
      <div className="modal-header">
        <div>
          <div className="modal-header-meta">
            <span className="market-kind">
              {isAuction ? (
                <Gavel size={13} aria-hidden="true" />
              ) : (
                <Tag size={13} aria-hidden="true" />
              )}
              {isAuction ? 'Аукцион' : 'Объявление'}
            </span>
            <span className="meta-chip">{isEditing ? 'Редактирование' : 'Новая запись'}</span>
          </div>
          <h2 className="modal-title" id={titleId}>
            {isEditing
              ? isAuction
                ? 'Редактировать аукцион'
                : 'Редактировать объявление'
              : isAuction
                ? 'Разместить аукцион'
                : 'Разместить объявление'}
          </h2>
        </div>
        <IconButton label="Закрыть" transparent onClick={onCancel}>
          <X size={20} />
        </IconButton>
      </div>

      <p className="market-form__lead">
        {isEditing
          ? 'Измените поля и сохраните — карточка обновится сразу.'
          : isAuction
            ? 'Задайте стартовую ставку, шаг и даты торгов — карточка сразу появится в разделе.'
            : 'Опишите издание и цену — карточка сразу появится в разделе объявлений.'}
      </p>

      <form className="market-form" onSubmit={handleSubmit}>
        <div className="market-form__grid">
          <FormField id="marketGame" label="Игра" className="market-form__full">
            <select
              id="marketGame"
              className="form-control"
              value={gameId}
              onChange={(event) => handleGameChange(event.target.value)}
              required
            >
              {games.length === 0 && <option value="">Каталог пуст</option>}
              {games.map((game) => {
                const platforms = [
                  ...new Set(
                    editions
                      .filter((edition) => edition.gameId === game.id)
                      .map((edition) => edition.platform),
                  ),
                ];

                return (
                  <option key={game.id} value={game.id}>
                    {game.title}
                    {platforms.length > 0 ? ` (${platforms.join(', ')})` : ''}
                  </option>
                );
              })}
            </select>
          </FormField>

          {!isAuction && (
            <FormField
              id="marketListingType"
              label="Тип объявления"
              className="market-form__full"
            >
              <select
                id="marketListingType"
                className="form-control"
                required
                value={listingType}
                onChange={(event) =>
                  handleListingTypeChange(event.target.value as MarketListingType)
                }
              >
                {MARKET_LISTING_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField id="marketEdition" label="Издание" className="market-form__full">
            <select
              id="marketEdition"
              className="form-control"
              required={!isPurchase}
              value={editionId}
              onChange={(event) => setEditionId(event.target.value)}
            >
              {isPurchase && <option value="">Любое издание</option>}
              {gameEditions.length === 0 && <option value="">Нет изданий</option>}
              {gameEditions.map((edition) => (
                <option key={edition.id} value={edition.id}>
                  {editionLabel(edition)}
                </option>
              ))}
            </select>
            <p className="market-form__hint">
              {isPurchase
                ? 'Для покупки можно оставить «Любое издание», если готовы взять любую версию.'
                : 'Издание определяет платформу, регион, язык и комплектацию лота.'}
            </p>
          </FormField>

          <FormField id="marketTitle" label="Заголовок" className="market-form__full">
            <input
              id="marketTitle"
              type="text"
              className="form-control"
              required
              maxLength={120}
              placeholder={
                selectedGame
                  ? `${selectedGame.title} — полный комплект`
                  : 'Например, полный комплект CIB'
              }
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>

          <FormField id="marketCondition" label="Состояние / комплект">
            <input
              id="marketCondition"
              type="text"
              className="form-control"
              required
              maxLength={60}
              placeholder="9/10, CIB"
              value={condition}
              onChange={(event) => setCondition(event.target.value)}
            />
          </FormField>

          <FormField
            id="marketPrice"
            label={isAuction ? 'Стартовая ставка (₽)' : 'Цена (₽)'}
          >
            <input
              id="marketPrice"
              type="number"
              className="form-control"
              required
              min={1}
              max={99_999_999}
              step={1}
              inputMode="numeric"
              placeholder={isAuction ? '4200' : '6900'}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </FormField>

          {isAuction && (
            <div className="market-form__full market-form__timing">
              <FormField id="marketBidStep" label="Шаг цены (₽)">
                <input
                  id="marketBidStep"
                  type="number"
                  className="form-control"
                  required
                  min={1}
                  max={99_999_999}
                  step={1}
                  inputMode="numeric"
                  placeholder="100"
                  value={bidStep}
                  onChange={(event) => setBidStep(event.target.value)}
                />
              </FormField>

              <FormField id="marketStartsAt" label="Открытие аукциона">
                <input
                  id="marketStartsAt"
                  type="datetime-local"
                  className="form-control"
                  required
                  value={startsAt}
                  onChange={(event) => {
                    setStartsAt(event.target.value);
                    setAuctionTimeError('');
                  }}
                />
              </FormField>

              <FormField id="marketEndsAt" label="Закрытие аукциона">
                <input
                  id="marketEndsAt"
                  type="datetime-local"
                  className="form-control"
                  required
                  value={endsAt}
                  aria-invalid={Boolean(auctionTimeError)}
                  aria-describedby={
                    auctionTimeError ? 'marketAuctionTimeError' : undefined
                  }
                  onChange={(event) => {
                    setEndsAt(event.target.value);
                    setAuctionTimeError('');
                  }}
                />
              </FormField>

              {auctionTimeError && (
                <p
                  className="market-form__error market-form__timing-error"
                  id="marketAuctionTimeError"
                  role="alert"
                >
                  {auctionTimeError}
                </p>
              )}
            </div>
          )}

          <FormField id="marketShipsFrom" label="Откуда отправляет">
            <input
              id="marketShipsFrom"
              type="text"
              className="form-control"
              required
              maxLength={80}
              placeholder="Москва"
              value={shipsFrom}
              onChange={(event) => setShipsFrom(event.target.value)}
            />
          </FormField>

          <FormField id="marketPackagingPrice" label="Цена упаковки посылки (₽)">
            <input
              id="marketPackagingPrice"
              type="number"
              className="form-control"
              min={0}
              max={99_999_999}
              step={1}
              inputMode="numeric"
              placeholder="0"
              value={packagingPrice}
              onChange={(event) => setPackagingPrice(event.target.value)}
            />
            <p className="market-form__hint">
              0 — бесплатно, пусто — не указывать.
            </p>
          </FormField>

          <fieldset
            className="market-form__full market-delivery"
            aria-required="true"
            aria-invalid={Boolean(deliveryError)}
            aria-describedby={deliveryError ? 'marketDeliveryError' : undefined}
          >
            <legend className="form-label">Службы доставки</legend>
            <div className="market-delivery__options">
              {DELIVERY_SERVICES.map((service) => {
                const isSelected = deliveryServices.includes(service.value);

                return (
                  <label
                    key={service.value}
                    className={cx(
                      'market-delivery__option',
                      isSelected && 'is-selected',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleDeliveryService(service.value)}
                    />
                    <span>{service.label}</span>
                  </label>
                );
              })}
            </div>
            {deliveryError && (
              <p className="market-form__error" id="marketDeliveryError" role="alert">
                {deliveryError}
              </p>
            )}
          </fieldset>

          <label className="market-form__full market-toggle">
            <input
              type="checkbox"
              checked={internationalShipping}
              onChange={(event) => setInternationalShipping(event.target.checked)}
            />
            <span className="market-toggle__copy">
              <span className="market-toggle__title">Доставка в другие страны</span>
              <span className="market-toggle__hint">
                Покупатели увидят, готовы ли вы отправлять за границу.
              </span>
            </span>
          </label>

          <FormField id="marketDescription" label="Описание" className="market-form__full">
            <textarea
              id="marketDescription"
              className="form-control"
              required
              rows={5}
              maxLength={600}
              placeholder="Состояние диска, комплектность, условия отправки…"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>

          <div className="market-form__full">
            <PhotoPicker
              photos={photos}
              onChange={setPhotos}
              onBusyChange={setIsProcessingPhotos}
            />
          </div>
        </div>

        <div className="market-form__actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" className="market-form__submit" disabled={isProcessingPhotos}>
            {isProcessingPhotos
              ? 'Обработка фото…'
              : isEditing
                ? 'Сохранить изменения'
                : isAuction
                  ? 'Запустить аукцион'
                  : 'Разместить объявление'}
          </button>
        </div>
      </form>
    </>
  );
}
