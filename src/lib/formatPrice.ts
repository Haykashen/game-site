const priceFormatter = new Intl.NumberFormat('ru-RU');

/** Formats a numeric price the same way the original template did. */
export function formatPrice(value: number): string {
  return `${priceFormatter.format(value)} ₽`;
}
