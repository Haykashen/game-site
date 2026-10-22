import { formatPrice } from './formatPrice';

const purchaseDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Human-readable purchase date; empty string stays empty. */
export function formatPurchaseDate(iso: string): string {
  if (!iso) return '';

  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : purchaseDateFormatter.format(date);
}

/** "4 990 ₽ · 12 сентября 2026 г." or "Куплено …" when the price is unknown. */
export function formatPurchaseDetails(price: number | null, date: string): string {
  const dateLabel = formatPurchaseDate(date);

  if (price === null) return dateLabel ? `Куплено ${dateLabel}` : '';

  const priceLabel = formatPrice(price);
  return dateLabel ? `${priceLabel} · ${dateLabel}` : priceLabel;
}
