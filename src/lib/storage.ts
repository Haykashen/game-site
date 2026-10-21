import type { Game, Lot } from '../types';

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

  return { id, title, platform, publisher, year, lang, description, lots };
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
