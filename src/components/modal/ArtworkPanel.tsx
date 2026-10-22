import { Image as ImageIcon } from 'lucide-react';
import { cx } from '../../lib/cx';
import { gameCoverImage } from '../../lib/editions';
import { editionsCountLabel } from '../../lib/market';
import type { Edition, Game } from '../../types';

interface ArtworkPanelProps {
  game: Game;
  editions: readonly Edition[];
}

/** Collector-archive artwork strip; the per-game gradient comes from CSS. */
export function ArtworkPanel({ game, editions }: ArtworkPanelProps) {
  const cover = gameCoverImage(game, editions);

  return (
    <div className={cx('carousel-container', `art-${game.id}`, cover && 'has-cover')}>
      {cover && <img className="carousel-cover" src={cover} alt="" loading="lazy" />}
      <div className="artwork-scanlines" />
      {!cover && <ImageIcon size={52} style={{ opacity: 0.6, marginBottom: '0.75rem' }} />}
      <span className="gallery-kicker">COLLECTOR ARCHIVE</span>
      <strong>{game.title}</strong>
      <span className="gallery-caption">
        {editionsCountLabel(editions.length)} • {game.year}
      </span>
    </div>
  );
}
