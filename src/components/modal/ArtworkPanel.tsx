import { Image as ImageIcon } from 'lucide-react';
import { cx } from '../../lib/cx';
import type { Game } from '../../types';

interface ArtworkPanelProps {
  game: Game;
}

/** Collector-archive artwork strip; the per-game gradient comes from CSS. */
export function ArtworkPanel({ game }: ArtworkPanelProps) {
  return (
    <div className={cx('carousel-container', `art-${game.id}`)}>
      <div className="artwork-scanlines" />
      <ImageIcon size={52} style={{ opacity: 0.6, marginBottom: '0.75rem' }} />
      <span className="gallery-kicker">COLLECTOR ARCHIVE</span>
      <strong>{game.title}</strong>
      <span className="gallery-caption">Бокс • Диск • Мануал</span>
    </div>
  );
}
