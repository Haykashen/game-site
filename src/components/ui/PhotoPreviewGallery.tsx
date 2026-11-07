import { Image as ImageIcon } from 'lucide-react';
import { useRef, useState } from 'react';

interface Props {photos: readonly string[]; title: string}
export function PhotoPreviewGallery({photos, title}: Props) {
  const unique = [...new Set(photos.filter(Boolean))];
  return <Preview key={JSON.stringify(unique)} photos={unique} title={title} />;
}
function Preview({photos, title}: Props) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const start = useRef<{x: number; y: number} | null>(null);
  const available = photos.filter(photo => !failed.includes(photo));
  const active = Math.min(index, Math.max(0, available.length - 1));
  const multiple = available.length > 1;
  const move = (step: number) => setIndex((active + step + available.length) % available.length);
  if (!available.length) return <div className="copy-card__placeholder"><ImageIcon size={28} aria-hidden="true" /><span>Фото недоступны</span></div>;
  return <div className="photo-preview" role="group" aria-roledescription="галерея" aria-label={title}
    onPointerLeave={event => {if (event.pointerType === 'mouse') setIndex(0);}}
    onKeyDown={event => {
      if (!multiple || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1);
    }}>
    <div className="photo-preview__stage"
      onPointerMove={event => {
        if (!multiple || event.pointerType !== 'mouse') return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width > 0) setIndex(Math.max(0, Math.min(available.length - 1, Math.floor((event.clientX - rect.left) / rect.width * available.length))));
      }}
      onPointerDown={event => {
        if (event.pointerType === 'mouse' || !multiple) return;
        start.current = {x: event.clientX, y: event.clientY};
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {start.current = null;}}
      onPointerUp={event => {
        const origin = start.current; start.current = null;
        if (!origin) return;
        const dx = event.clientX - origin.x, dy = event.clientY - origin.y;
        if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
      }}>
      <img src={available[active]} alt={multiple ? `Фото ${active + 1} из ${available.length}: ${title}` : title}
        loading="lazy" decoding="async" draggable={false} referrerPolicy="no-referrer"
        onError={() => {setFailed(previous => [...previous, available[active]!]); setIndex(0);}} />
    </div>
    {multiple && <div className="photo-preview__dots" role="group" aria-label="Выбор фотографии">
      {available.map((photo, position) => <button key={photo} type="button"
        className={position === active ? 'photo-preview__dot is-active' : 'photo-preview__dot'}
        aria-label={`Показать фото ${position + 1} из ${available.length}`} aria-pressed={position === active}
        onClick={() => setIndex(position)}><span /></button>)}
    </div>}
  </div>;
}
