import { z } from 'zod';

/** Identifiers can be database UUIDs or stable slugs from the demo catalogue. */
export const idSchema = z.string().trim().min(1).max(100);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return {
    items,
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Accepts any string parseable by `Date`; the API always answers with ISO strings. */
export const isoDateTimeSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Некорректная дата и время.');

export const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD.')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Некорректная дата.');

export const emptyOrDateOnlySchema = z.union([z.literal(''), dateOnlySchema]);

/** Photos may be an absolute URL or a compressed browser data URL. */
export const photoReferenceSchema = z.string().trim().min(1).max(2_000_000);

/**
 * Upper bound keeps `toMinorUnits()` inside PostgreSQL INTEGER, which is used
 * for all money columns. 10 000 000 RUB = 1 000 000 000 kopecks.
 */
export const MAX_RUBLE_AMOUNT = 10_000_000;

export const rubleAmountSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_RUBLE_AMOUNT);
export const nonNegativeRubleAmountSchema = z.coerce
  .number()
  .int()
  .min(0)
  .max(MAX_RUBLE_AMOUNT);

export function toMinorUnits(rubles: number): number {
  return Math.round(rubles * 100);
}

export function fromMinorUnits(minor: number): number {
  return Math.round(minor / 100);
}
