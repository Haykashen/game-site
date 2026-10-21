import type { Game, Lot, MarketDeliveryService, MarketEntry } from '../types';
import { MAX_MARKET_PHOTOS } from './constants';
import { isDeliveryService } from './delivery';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const readNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** `crypto.randomUUID` is missing in a few older WebViews — fall back gracefully. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLot(value: unknown, gameId: string, index: number): Lot | null {
  if (!isRecord(value)) return null;

  const type = value.type;
  const title = readString(value.title);
  const condition = readString(value.condition);
  const user = readString(value.user);
  const price = readNumber(value.price);

  if ((type !== 'sale' && type !== 'purchase') || !title || !condition || !user || price === null) {
    return null;
  }

  // Lots saved by the pre-React version had no id: backfill one during migration.
  return {
    id: readString(value.id) ?? `${gameId}-lot-${index}-${createId()}`,
    type,
    title,
    condition,
    user,
    price,
  };
}

function normalizeGame(value: unknown): Game | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id);
  const title = readString(value.title);
  const platform = readString(value.platform);
  const publisher = readString(value.publisher);
  const lang = readString(value.lang);
  const description = readString(value.description);
  const year = readNumber(value.year);
  const rawLots = Array.isArray(value.lots) ? value.lots : [];

  if (!id || !title || !platform || !publisher || !lang || !description || year === null) {
    return null;
  }

  const lots = rawLots
    .map((lot, index) => normalizeLot(lot, id, index))
    .filter((lot): lot is Lot => lot !== null);

  // Collector metadata arrived later than the first payloads: older saves simply
  // have empty values, and the catalogue seeds fill them in on read.
  return {
    id,
    title,
    platform,
    publisher,
    developer: readString(value.developer) ?? '',
    series: readString(value.series) ?? '',
    year,
    lang,
    region: readString(value.region) ?? '',
    edition: readString(value.edition) ?? '',
    completeness: readString(value.completeness) ?? '',
    media: readString(value.media) ?? '',
    description,
    lots,
  };
}

/** Returns `null` for payloads that cannot be trusted, so the caller can fall back to seeds. */
export function parseGames(value: unknown): Game[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(normalizeGame).filter((game): game is Game => game !== null);
}

export function parseOwnedIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0);
}

/** Old saved entries predate photos, so a missing field simply means an empty gallery. */
function readPhotos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (photo): photo is string =>
        typeof photo === 'string' && photo.startsWith('data:image/'),
    )
    .slice(0, MAX_MARKET_PHOTOS);
}

/** Legacy entries predate the logistics fields, so every reader has a safe default. */
function readDeliveryServices(value: unknown): MarketDeliveryService[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.filter(isDeliveryService))];
}

function readPackagingPrice(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function readBidStep(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function normalizeMarketEntry(value: unknown): MarketEntry | null {
  if (!isRecord(value)) return null;

  const kind = value.kind;
  const id = readString(value.id);
  const gameId = readString(value.gameId);
  const title = readString(value.title);
  const edition = (readString(value.edition) ?? '').slice(0, 80);
  const region = (readString(value.region) ?? '').slice(0, 80);
  const condition = readString(value.condition);
  const seller = readString(value.seller);
  const description = readString(value.description);
  const photos = readPhotos(value.photos);
  const deliveryServices = readDeliveryServices(value.deliveryServices);
  const internationalShipping =
    typeof value.internationalShipping === 'boolean'
      ? value.internationalShipping
      : null;
  const packagingPrice = readPackagingPrice(value.packagingPrice);
  const shipsFrom = (readString(value.shipsFrom) ?? '').slice(0, 80);
  const price = readNumber(value.price);
  const bids = readNumber(value.bids) ?? 0;
  const bidStep = readBidStep(value.bidStep);
  const createdAt = readString(value.createdAt);
  const rawStartsAt = value.startsAt === null ? null : readString(value.startsAt);
  const startsAt =
    rawStartsAt && !Number.isNaN(Date.parse(rawStartsAt)) ? rawStartsAt : null;
  const endsAt = value.endsAt === null ? null : readString(value.endsAt);

  if (
    (kind !== 'listing' && kind !== 'auction') ||
    !id ||
    !gameId ||
    !title ||
    !condition ||
    !seller ||
    !description ||
    price === null ||
    price <= 0 ||
    !Number.isInteger(bids) ||
    bids < 0 ||
    !createdAt ||
    Number.isNaN(Date.parse(createdAt))
  ) {
    return null;
  }

  if (kind === 'auction' && (!endsAt || Number.isNaN(Date.parse(endsAt)))) return null;
  if (kind === 'listing' && endsAt !== null) return null;

  return {
    id,
    kind,
    gameId,
    title,
    edition,
    region,
    condition,
    price,
    seller,
    description,
    photos,
    deliveryServices,
    internationalShipping,
    packagingPrice,
    shipsFrom,
    bids,
    bidStep: kind === 'auction' ? bidStep : null,
    startsAt: kind === 'auction' ? (startsAt ?? createdAt) : null,
    endsAt,
    createdAt,
  };
}

/** Malformed or legacy market payloads are dropped one by one, never crashing the page. */
export function parseMarketEntries(value: unknown): MarketEntry[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .map(normalizeMarketEntry)
    .filter((entry): entry is MarketEntry => entry !== null);
}

export function readStorage<T>(
  key: string,
  fallback: T,
  parse?: (value: unknown) => T | null,
): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;

    const value: unknown = JSON.parse(raw);
    if (!parse) return value as T;

    return parse(value) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or disabled; the in-memory state still works.
  }
}
