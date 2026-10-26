import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { useState } from 'react';
import { cx } from '../../lib/cx';
import { artworkImages } from '../../lib/editions';
import { editionsCountLabel } from '../../lib/market';
import type { Edition, Game } from '../../types';

interface ArtworkPanelProps {
  game: Game;
  editions: readonly Edition[];
  selectedEdition?: Edition | undefined;
}

/** Collector-archive artwork strip; the per-game gradient comes from CSS. */
export function ArtworkPanel({ game, editions, selectedEdition }: ArtworkPanelProps) {
  const images = artworkImages(game, editions, selectedEdition);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const cover = images[index];
  const hasCover = Boolean(cover && !failed.includes(cover));

  return (
    <div className={cx('carousel-container', `art-${game.id}`, hasCover && 'has-cover')}>
      {hasCover && <img className="carousel-cover" src={cover} alt={`Обложка ${game.title}${selectedEdition ? ` — ${selectedEdition.name}, ${selectedEdition.platform}` : ''}`} referrerPolicy="no-referrer" onError={() => setFailed(previous => [...previous, cover!])} />}
      <div className="artwork-scanlines" />
      {!hasCover && <ImageIcon size={52} style={{ opacity: 0.6, marginBottom: '0.75rem' }} />}
      <span className="gallery-kicker">COLLECTOR ARCHIVE</span>
      <strong>{game.title}</strong>
      <span className="gallery-caption">
        {selectedEdition ? `${selectedEdition.name} • ${selectedEdition.platform}` : editionsCountLabel(editions.length)}
        {game.year !== null ? ` • ${game.year}` : ''}
      </span>
      {cover && !hasCover && <span className="gallery-caption" role="status">Не удалось загрузить изображение</span>}
      {images.length > 1 && <div className="artwork-controls" aria-label="Изображения издания">
        <button type="button" className="btn-secondary" aria-label="Предыдущее изображение" onClick={() => setIndex(previous => (previous - 1 + images.length) % images.length)}><ChevronLeft size={18} /></button>
        <span aria-live="polite">{index + 1} / {images.length}</span>
        <button type="button" className="btn-secondary" aria-label="Следующее изображение" onClick={() => setIndex(previous => (previous + 1) % images.length)}><ChevronRight size={18} /></button>
      </div>}
    </div>
  );
}
