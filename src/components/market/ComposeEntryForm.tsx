import { RecognizeGame } from './RecognizeGame';
import { apiRequest } from '../../api/client';
import { Gavel, Tag, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MARKET_ITEM_OPTIONS, marketItemLabel, type MarketItemType } from '@discvault/shared';
import type { FormEvent } from 'react';
import { cx } from '../../lib/cx';
import { DELIVERY_SERVICES } from '../../lib/delivery';
import { editionLabel } from '../../lib/editions';
import {
  listingTypeLabel,
  MARKET_LISTING_TYPE_OPTIONS,
} from '../../lib/market';
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
import { DeliveryServiceIcon } from './DeliveryServiceIcon';
import { GameCombobox } from '../ui/GameCombobox';

interface ComposeEntryFormProps {
  kind: MarketKind;
  /** Preset for a new listing; ignored when editing an existing entry. */
  initialListingType?: MarketListingType | undefined;
  games: readonly Game[];
  editions: readonly Edition[];
  /** Game preselected when the flow started from a game card. */
  initialGameId: string;
  /** Edition preselected when the flow started from an edition card. */
  initialEditionId: string;
  /** When present, the form edits this entry instead of creating a new one. */
  entry?: MarketEntry;
  sourceEntry?: MarketEntry;
  titleId: string;
  onSubmit: (draft: MarketDraft) => Promise<void>;
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
  initialListingType,
  games: catalogGames,
  editions: catalogEditions,
  initialGameId,
  initialEditionId,
  entry: editingEntry,
  sourceEntry,
  titleId,
  onSubmit,
  onCancel,
}: ComposeEntryFormProps) {
  const entry = editingEntry ?? (sourceEntry ? {...sourceEntry, startsAt: null, endsAt: null, price: sourceEntry.startPrice ?? sourceEntry.price, moderationStatus: 'draft' as const} : undefined);
  const [recognizedGames, setRecognizedGames] = useState<Game[]>([]);
  const [recognizedEditions, setRecognizedEditions] = useState<Edition[]>([]);
  const games = [...catalogGames.filter(game => !recognizedGames.some(item => item.id === game.id)), ...recognizedGames];
  const editions = [...catalogEditions.filter(edition => !recognizedEditions.some(item => item.id === edition.id)), ...recognizedEditions];
  const isEditing = Boolean(editingEntry);
  const formKind = entry?.kind ?? kind;
  const isAuction = formKind === 'auction';
  const defaultGameId = entry?.gameId || initialGameId || '';

  const editionsForGame = (gameId: string) => editions.filter((edition) => edition.gameId === gameId);

  const defaultEditionId = (gameId: string) => {
    const gameEditions = editionsForGame(gameId);
    const preferred = gameEditions.find((edition) => edition.id === initialEditionId || edition.variants?.some(variant => variant.id === initialEditionId));
    return preferred?.id ?? gameEditions[0]?.id ?? '';
  };

  const [gameId, setGameId] = useState(defaultGameId);
  const [itemType, setItemType] = useState<MarketItemType>(entry?.itemType ?? 'game');
  const isLoot = itemType !== 'game';
  const [listingType, setListingType] = useState<MarketListingType>(
    entry?.listingType ?? initialListingType ?? 'sale',
  );
  const [editionId, setEditionId] = useState(() =>
    entry ? (entry.editionId ?? '') : defaultEditionId(defaultGameId),
  );
  const pendingInitialEdition = useRef(!entry && Boolean(initialGameId));
  const fallbackEditionId = defaultEditionId(gameId);
  useEffect(() => {
    // Retain the game ID from the URL while the catalogue loads, then resolve its edition once.
    if (pendingInitialEdition.current && gameId && fallbackEditionId) {
      setEditionId(fallbackEditionId);
      pendingInitialEdition.current = false;
    }
  }, [gameId, fallbackEditionId]);
  const [titleOverride, setTitle] = useState<string | null>(entry?.title ?? null);
  const [submissionStatus, setSubmissionStatus] = useState<'draft' | 'pending'>(entry?.moderationStatus === 'draft' ? 'draft' : 'pending');
  const [condition, setCondition] = useState(entry?.condition ?? '');
  const [localizationId, setLocalizationId] = useState(entry?.localizationId ?? '');
  const [localizations, setLocalizations] = useState<{id: string; name: string}[]>([]);
  const [localizationError, setLocalizationError] = useState('');
  const [photoError, setPhotoError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<{items: {id: string; name: string}[]}>('/api/v1/market/localizations', {signal: controller.signal})
      .then(result => {if (!controller.signal.aborted) setLocalizations(result.items);})
      .catch(() => {if (!controller.signal.aborted) setLocalizationError('Не удалось загрузить локализации. Повторно откройте форму.');});
    return () => controller.abort();
  }, []);
  const [price, setPrice] = useState(
    entry ? String(entry.startPrice ?? entry.price) : '',
  );
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
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const selectedEdition = gameEditions.find((edition) => edition.id === editionId);
  const suggestedTitle = [
    selectedGame?.title,
    selectedEdition?.name,
    selectedEdition?.platform,
    selectedEdition?.region,
    isLoot ? marketItemLabel(itemType) : null,
  ]
    .filter(Boolean).join(' · ').slice(0, 120);
  const title = titleOverride ?? suggestedTitle;
  const isPurchase = !isAuction && listingType === 'purchase';
  const listingComposeTitle =
    listingType === 'purchase'
      ? 'Разместить покупку'
      : listingType === 'exchange'
        ? 'Предложить обмен'
        : 'Разместить продажу';

  const handleGameChange = (nextGameId: string) => {
    pendingInitialEdition.current = false;
    setGameId(nextGameId);
    setEditionId(isLoot ? '' : defaultEditionId(nextGameId));
    setTitle(null);
  };

  const handleListingTypeChange = (nextType: MarketListingType) => {
    setListingType(nextType);

    if (!isLoot && nextType !== 'purchase' && !editionId) {
      setEditionId(editionsForGame(gameId)[0]?.id ?? '');
      setTitle(null);
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPhotoError('');
    if (submissionStatus !== 'draft' && photos.length === 0) {setPhotoError('Добавьте хотя бы одну фотографию предмета перед отправкой на проверку.'); return;}

    if (isProcessingPhotos || isSubmitting) return;

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

    if (!isLoot && !isPurchase && !trimmedEditionId) return;
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

    setIsSubmitting(true);
    try { await onSubmit({
      kind: formKind,
      itemType,
      listingType: isAuction ? null : listingType,
      gameId,
      editionId: trimmedEditionId || null,
      submissionStatus,
      localizationId: isLoot ? null : localizationId || null,
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
    }); } finally { setIsSubmitting(false); }
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
              {isAuction ? 'Аукцион' : listingTypeLabel(listingType)}
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
                : listingComposeTitle}
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
            : listingType === 'purchase'
              ? 'Опишите, какую игру или лут ищете, — карточка появится в разделе покупок.'
              : listingType === 'exchange'
                ? 'Опишите игру или лут и условия обмена.'
                : 'Опишите игру или лут и укажите цену.'}
      </p>

      <form className="market-form" onSubmit={handleSubmit}>
        {!isEditing && !isLoot && <RecognizeGame photo={photos[0]} onSelect={(match, source) => {
          setRecognizedGames(previous => [...previous.filter(game => game.id !== match.game.id), match.game]);
          setRecognizedEditions(previous => [...previous.filter(edition => edition.id !== match.edition.id), match.edition]);
          pendingInitialEdition.current = false;
          setGameId(match.game.id); setEditionId(match.edition.id);
          setTitle(null);
          setPhotos(previous => previous.includes(source) ? previous : previous.length < 6 ? [...previous, source] : previous);
        }} />}
        <div className="market-form__grid">
          <FormField id="marketItemType" label="Что размещаете" className="market-form__full">
            <select id="marketItemType" className="form-control" value={itemType} required
              onChange={(event) => {
                const next = event.target.value as MarketItemType;
                setItemType(next);
                if (next === 'game' && !isPurchase && !editionId) setEditionId(defaultEditionId(gameId));
                if (itemType === 'game' && next !== 'game' && !initialEditionId) setEditionId('');
                setTitle(null);
              }}>
              {MARKET_ITEM_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <p className="market-form__hint">Лут продаётся отдельно от игры: выберите предмет, который получит покупатель.</p>
          </FormField>
          <FormField id="marketGame" label="Игра" className="market-form__full">
            <GameCombobox id="marketGame" games={games} value={gameId}
              onChange={handleGameChange} required />
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

          <FormField id="marketEdition" label={isLoot ? 'Издание (необязательно)' : 'Издание'} className="market-form__full">
            <select
              id="marketEdition"
              className="form-control"
              required={!isPurchase && !isLoot}
              value={editionId}
              onChange={(event) => {
                setEditionId(event.target.value);
                setTitle(null);
              }}
            >
              {(isPurchase || isLoot) && <option value="">{isLoot ? 'Без привязки к изданию' : 'Любое издание'}</option>}
              {gameEditions.length === 0 && <option value="">Нет изданий</option>}
              {gameEditions.map((edition) => (
                <option key={edition.id} value={edition.id}>
                  {editionLabel(edition)}
                </option>
              ))}
            </select>
            <p className="market-form__hint">
              {isLoot ? 'Укажите издание, если предмет относится к конкретной версии игры. Игра в комплект не включена.' : isPurchase
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
              placeholder={suggestedTitle || 'Название объявления'}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </FormField>

          {!isLoot && <FormField id="marketLocalization" label="Локализация">
            <select id="marketLocalization" className="form-control" value={localizationId} onChange={event => setLocalizationId(event.target.value)}>
              <option value="">Не указано</option>
              {localizationId && !localizations.some(item => item.id === localizationId) && <option value={localizationId}>{entry?.localization ?? 'Текущая локализация'}</option>}
              {localizations.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            {localizationError && <p role="alert">{localizationError}</p>}
          </FormField>}
          <FormField id="marketCondition" label="Состояние / комплект">
            <input
              id="marketCondition"
              type="text"
              className="form-control"
              required
              maxLength={60}
              placeholder={isLoot ? 'Оригинал, без повреждений' : '9/10, CIB'}
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

          <FormField id="marketShipsFrom" label="Откуда отправляет" className={isAuction ? 'market-form__full' : ''}>
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

          {!isAuction && <FormField id="marketPackagingPrice" label="Цена упаковки посылки (₽)">
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
          </FormField>}

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
                    <DeliveryServiceIcon service={service.value} />
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

          {!isAuction && <label className="market-form__full market-toggle">
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
          </label>}

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

        <FormField id="marketSubmissionStatus" label="Публикация">
          <select id="marketSubmissionStatus" className="form-control" value={submissionStatus} onChange={event => setSubmissionStatus(event.target.value as 'draft' | 'pending')}>
            <option value="draft">Сохранить черновик</option><option value="pending">Отправить на проверку</option>
          </select>
        </FormField>
        <div className="market-form__actions">
          {photoError && <p className="market-form__error" role="alert">{photoError}</p>}
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Отмена
          </button>
          <button type="submit" className="market-form__submit" disabled={isProcessingPhotos || isSubmitting}>
            {submissionStatus === 'draft' ? 'Сохранить черновик' : isSubmitting ? 'Сохраняем…' : isProcessingPhotos
              ? 'Обработка фото…'
              : isEditing
                ? 'Сохранить изменения'
                : isAuction
                  ? 'Запустить аукцион'
                  : listingComposeTitle}
          </button>
        </div>
      </form>
    </>
  );
}
