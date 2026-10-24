import type { MarketKind, MarketListingType } from '../types';

export const MARKET_LISTING_TYPE_OPTIONS = [
  { value: 'sale', label: 'Продажа' },
  { value: 'purchase', label: 'Покупка' },
  { value: 'exchange', label: 'Обмен' },
] as const satisfies readonly { value: MarketListingType; label: string }[];

/** Human label for cards and entity headers. */
export function listingTypeLabel(type: MarketListingType | null): string {
  if (type === null) return 'Объявление';

  return (
    MARKET_LISTING_TYPE_OPTIONS.find((option) => option.value === type)?.label ??
    'Объявление'
  );
}

/** Canonical route for a listing intention. */
export function marketListingPath(
  type: MarketListingType | null | undefined,
): string {
  if (type === 'purchase') return '/listings/purchases';
  if (type === 'exchange') return '/listings/exchange';
  return '/listings/sales';
}

const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
});

const longDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "до 24 окт." or "торги завершены" — compact enough for a card footer. */
export function formatAuctionEnd(iso: string | null): string {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'дата не указана';
  if (date.getTime() <= Date.now()) return 'торги завершены';

  return `до ${shortDateFormatter.format(date)}`;
}

/** "с 24 окт." for an auction that has not opened yet. */
export function formatAuctionStart(iso: string | null): string {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'дата не указана';

  return `с ${shortDateFormatter.format(date)}`;
}

export function formatMarketDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : longDateFormatter.format(date);
}

/** Full date and local time for auction opening and closing. */
export function formatMarketDateTime(iso: string | null): string {
  if (!iso) return '—';

  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

export function isAuctionOver(endsAt: string | null): boolean {
  if (!endsAt) return false;

  const timestamp = Date.parse(endsAt);
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}

export function isAuctionUpcoming(startsAt: string | null): boolean {
  if (!startsAt) return false;

  const timestamp = Date.parse(startsAt);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

/** Russian plural for bid counters: 1 ставка, 3 ставки, 7 ставок. */
export function bidsLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (last === 1 && lastTwo !== 11) return `${count} ставка`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} ставки`;
  return `${count} ставок`;
}

/** Russian plural for the catalogue tile: 1 лот, 3 лота, 5 лотов. */
export function lotsCountLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (last === 1 && lastTwo !== 11) return `${count} лот`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} лота`;
  return `${count} лотов`;
}

/** Russian plural for editions: 1 издание, 3 издания, 5 изданий. */
export function editionsCountLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (last === 1 && lastTwo !== 11) return `${count} издание`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} издания`;
  return `${count} изданий`;
}

/** Russian plural for the section counter: 1 объявление, 3 объявления, 5 объявлений. */
export function marketCountLabel(
  count: number,
  kind: MarketKind,
  listingType?: MarketListingType,
): string {
  const forms =
    kind === 'auction'
      ? (['аукцион', 'аукциона', 'аукционов'] as const)
      : listingType === 'sale'
        ? (['продажа', 'продажи', 'продаж'] as const)
        : listingType === 'purchase'
          ? (['покупка', 'покупки', 'покупок'] as const)
          : listingType === 'exchange'
            ? (['обмен', 'обмена', 'обменов'] as const)
            : (['объявление', 'объявления', 'объявлений'] as const);

  const lastTwo = count % 100;
  const last = count % 10;

  let formIndex = 2;
  if (last === 1 && lastTwo !== 11) formIndex = 0;
  else if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) formIndex = 1;

  return `${count} ${forms[formIndex] ?? forms[2]}`;
}
