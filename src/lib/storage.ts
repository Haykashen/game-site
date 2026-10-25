import type {
  Copy,
  Edition,
  Game,
  MarketDeliveryService,
  MarketEntry,
  MarketListingType,
} from '../types';
import { MAX_MARKET_PHOTOS } from './constants';
import { marketItemTypeSchema } from '@discvault/shared';
import { isDeliveryService } from './delivery';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const readNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const readStringList = (value: unknown, limit = 30): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, limit);
};

const isImageUrl = (value: string): boolean =>
  value.startsWith('data:image/') || /^https?:\/\//i.test(value);

const readImageList = (value: unknown, limit = 8): string[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === 'string' && isImageUrl(item))
    .slice(0, limit);
};

/** `crypto.randomUUID` is missing in a few older WebViews — fall back gracefully. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeGame(value: unknown): Game | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id);
  const title = readString(value.title);
  const publisher = readString(value.publisher);
  const description = readString(value.description);
  const year = readNumber(value.year);

  if (!id || !title || !publisher || !description || year === null) {
    return null;
  }

  return {
    id,
    title,
    publisher,
    developer: readString(value.developer) ?? '',
    series: readString(value.series) ?? '',
    year,
    genres: readStringList(value.genres, 8),
    description,
    coverImage: readString(value.coverImage) ?? '',
  };
}

/** Returns `null` for payloads that cannot be trusted, so the caller can fall back to seeds. */
export function parseGames(value: unknown): Game[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(normalizeGame).filter((game): game is Game => game !== null);
}

function normalizeEdition(value: unknown): Edition | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id);
  const gameId = readString(value.gameId);
  const name = readString(value.name);
  const platform = readString(value.platform);
  const region = readString(value.region);
  const lang = readString(value.lang);
  const media = readString(value.media);

  if (!id || !gameId || !name || !platform || !region || !lang || !media) {
    return null;
  }

  const rawReleaseDate = readString(value.releaseDate);
  const releaseDate =
    rawReleaseDate && !Number.isNaN(Date.parse(rawReleaseDate)) ? rawReleaseDate : '';

  return {
    id,
    gameId,
    name,
    platform,
    region,
    lang,
    media,
    releaseDate,
    description: readString(value.description) ?? '',
    contents: readStringList(value.contents),
    coverImages: readImageList(value.coverImages),
    barcode: readString(value.barcode) ?? '',
    dnsProductId: readString(value.dnsProductId) ?? '',
    dnsProductCode: readString(value.dnsProductCode) ?? '',
  };
}

export function parseEditions(value: unknown): Edition[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .map(normalizeEdition)
    .filter((edition): edition is Edition => edition !== null);
}

/** Purchase price is an optional non-negative integer in rubles. */
function readPurchasePrice(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

/** Strict `YYYY-MM-DD` check so hand-edited storage cannot shift the date. */
function readPurchaseDate(value: unknown): string {
  const raw = readString(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';

  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw
    ? ''
    : raw;
}

function normalizeCopy(value: unknown): Copy | null {
  if (!isRecord(value)) return null;

  const id = readString(value.id);
  const editionId = readString(value.editionId);
  const createdAt = readString(value.createdAt);

  if (!id || !editionId || !createdAt || Number.isNaN(Date.parse(createdAt))) {
    return null;
  }

  return {
    id,
    editionId,
    condition: readString(value.condition) ?? 'Не указано',
    completeness: readString(value.completeness) ?? 'Не указано',
    purchasePrice: readPurchasePrice(value.purchasePrice),
    purchaseDate: readPurchaseDate(value.purchaseDate),
    notes: readString(value.notes) ?? '',
    photos: readImageList(value.photos, MAX_MARKET_PHOTOS),
    createdAt,
  };
}

export function parseCopies(value: unknown): Copy[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(normalizeCopy).filter((copy): copy is Copy => copy !== null);
}

/** Legacy saves stored a game-level collection; these ids seed the first copies. */
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

/** Old listings predate the intention field, so they become fixed-price sales. */
function readListingType(
  value: unknown,
  kind: MarketEntry['kind'],
): MarketListingType | null {
  if (kind === 'auction') return null;
  if (value === 'sale' || value === 'purchase' || value === 'exchange') return value;
  return 'sale';
}

/** Seeds and legacy entries have no lifecycle field; they are live by default. */
function readStatus(value: unknown): MarketEntry['status'] {
  return value === 'sold' || value === 'closed' ? value : 'active';
}

interface EditionLookup {
  readonly byId: ReadonlyMap<string, Edition>;
  readonly firstByGame: ReadonlyMap<string, string>;
  /** Legacy market entries stored `edition` and `region` as free-form strings. */
  readonly byLegacyKey: ReadonlyMap<string, string>;
}

function createEditionLookup(editions: readonly Edition[]): EditionLookup {
  const byId = new Map<string, Edition>();
  const firstByGame = new Map<string, string>();
  const byLegacyKey = new Map<string, string>();

  for (const edition of editions) {
    byId.set(edition.id, edition);
    if (!firstByGame.has(edition.gameId)) firstByGame.set(edition.gameId, edition.id);
    byLegacyKey.set(
      `${edition.gameId}|${edition.name}|${edition.region}`,
      edition.id,
    );
  }

  return { byId, firstByGame, byLegacyKey };
}

function normalizeMarketEntry(
  value: unknown,
  lookup: EditionLookup,
): MarketEntry | null {
  if (!isRecord(value)) return null;

  const kind = value.kind;
  const id = readString(value.id);
  const gameId = readString(value.gameId);
  const title = readString(value.title);
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

  const listingType = readListingType(value.listingType, kind);
  const parsedItemType = marketItemTypeSchema.safeParse(value.itemType ?? 'game');
  if (!parsedItemType.success) return null;
  const itemType = parsedItemType.data;
  const directEditionId = readString(value.editionId);
  const legacyEdition = readString(value.edition);
  const legacyRegion = readString(value.region);
  const directMatch =
    directEditionId && lookup.byId.get(directEditionId)?.gameId === gameId
      ? directEditionId
      : null;
  const legacyMatch =
    legacyEdition && legacyRegion
      ? lookup.byLegacyKey.get(`${gameId}|${legacyEdition}|${legacyRegion}`) ?? null
      : null;
  let editionId = directMatch ?? legacyMatch;
  const editionRequired = itemType === 'game' && (kind === 'auction' || listingType !== 'purchase');

  if (!editionId && editionRequired) {
    editionId = lookup.firstByGame.get(gameId) ?? null;
  }

  if (editionRequired && !editionId) return null;

  return {
    id,
    kind,
    listingType,
    itemType,
    gameId,
    editionId,
    title,
    condition,
    price,
    seller,
    description,
    status: readStatus(value.status),
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

/**
 * Malformed or legacy market payloads are dropped one by one, never crashing the
 * page. `editions` lets old `edition` + `region` entries find their new edition id.
 */
export function parseMarketEntries(
  value: unknown,
  editions: readonly Edition[] = [],
): MarketEntry[] | null {
  if (!Array.isArray(value)) return null;
  const lookup = createEditionLookup(editions);

  return value
    .map((entry) => normalizeMarketEntry(entry, lookup))
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
