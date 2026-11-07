/** Editable ruble amount, accepting formatted clipboard values without losing kopecks. */
export function cleanMoneyInput(value: string): string | null {
  const raw = value.trim().replace(/\s/g, '').replace(/₽$/, '').replace('.', ',');
  return /^(?:\d+(?:,\d{0,2})?|,\d{0,2})?$/.test(raw) ? raw : null;
}
export function parseMoneyInput(value: string): number | null {
  const raw = cleanMoneyInput(value);
  if (raw === null || raw === '' || raw === ',') return null;
  return Number(raw.replace(',', '.'));
}
export function formatMoneyInput(value: string): string {
  const number = parseMoneyInput(value);
  return number === null ? '' : new Intl.NumberFormat('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(number);
}
