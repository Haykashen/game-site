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

/** Representative artwork: game cover first, then the first edition cover. */
export function gameCoverImage(game: Game, editions: readonly Edition[]): string {
  if (game.coverImage) return game.coverImage;

  for (const edition of editions) {
    const cover = edition.coverImages[0];
    if (cover) return cover;
  }

  return '';
}
