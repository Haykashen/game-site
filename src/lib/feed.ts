const shortDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
});

const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** Compact date for feed cards: "23 окт." */
export function formatFeedDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : shortDateFormatter.format(date);
}

/** Date and time for discussion replies. */
export function formatFeedDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : dateTimeFormatter.format(date);
}

function pluralize(count: number, forms: readonly [string, string, string]): string {
  const lastTwo = count % 100;
  const last = count % 10;

  if (last === 1 && lastTwo !== 11) return `${count} ${forms[0]}`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} ${forms[1]}`;
  }

  return `${count} ${forms[2]}`;
}

/** "1 тема", "3 темы", "7 тем". */
export function topicsCountLabel(count: number): string {
  return pluralize(count, ['тема', 'темы', 'тем']);
}

/** "1 новость", "3 новости", "7 новостей". */
export function newsCountLabel(count: number): string {
  return pluralize(count, ['новость', 'новости', 'новостей']);
}

/** "1 ответ", "3 ответа", "7 ответов". */
export function commentsCountLabel(count: number): string {
  return pluralize(count, ['ответ', 'ответа', 'ответов']);
}

/** "1 просмотр", "3 просмотра", "7 просмотров". */
export function viewsCountLabel(count: number): string {
  return pluralize(count, ['просмотр', 'просмотра', 'просмотров']);
}

/** Rough reading time for a demo article; intentionally rounded up. */
export function readingTimeLabel(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 160));

  return `${minutes} мин`;
}
