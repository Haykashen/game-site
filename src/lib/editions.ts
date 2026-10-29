import type { Edition, Game } from '../types';

const editionDateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Compact release date for edition cards; empty string stays dash-like. */
export function formatEditionDate(iso: string): string {
  if (!iso) return '—';

  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : editionDateFormatter.format(date);
}

/** Human label used in selects and chips, e.g. "Standard • PS2 • PAL". */
export function editionLabel(edition: Edition): string {
  return [edition.name, edition.platform, edition.region].filter(Boolean).join(' • ');
}

export function editionContentsLabel(edition: Edition, limit = 4): string {
  if (edition.contents.length === 0) return 'Комплект не указан';

  const visible = edition.contents.slice(0, limit);
  const hidden = edition.contents.length - visible.length;

  return hidden > 0 ? `${visible.join(', ')} и ещё ${hidden}` : visible.join(', ');
}

export function gameCoverImages(game: Game, editions: readonly Edition[]): string[] {
  return [...new Set([game.coverImage, ...editions.flatMap(edition => edition.coverImages)].filter(Boolean))];
}
export function gameCoverImage(game: Game, editions: readonly Edition[]): string {
  return gameCoverImages(game, editions)[0] ?? '';
}

/** An edition selection must never show another edition's artwork. */
export function artworkImages(game: Game, editions: readonly Edition[], selectedEdition?: Edition): string[] {
  if (selectedEdition) return [...new Set(selectedEdition.coverImages.filter(Boolean))];
  const cover = gameCoverImage(game, editions);
  return cover ? [cover] : [];
}
