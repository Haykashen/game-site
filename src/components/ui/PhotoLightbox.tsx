import { ChevronLeft, ChevronRight, Download, Minus, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

interface Props {photos: readonly string[]; title: string; initialIndex: number; onClose: () => void}
/** Native modal provides focus containment and Escape; controls stay in a bounded frame. */
export function PhotoLightbox({photos, title, initialIndex, onClose}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1.25);
  const start = useRef<{x: number; y: number} | null>(null);
  const active = Math.min(index, photos.length - 1);
  const select = (next: number) => {setIndex((next + photos.length) % photos.length); setZoom(1);};
  useBodyScrollLock(true);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element?.showModal();
    return () => {element?.close(); if (previous instanceof HTMLElement) previous.focus();};
  }, []);
  return createPortal(<dialog ref={dialog} className="photo-lightbox" aria-label={`Фотографии: ${title}`} onCancel={event => {event.preventDefault(); onClose();}}
    onClick={event => {if (event.target === event.currentTarget) onClose();}}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault(); select(active + (event.key === 'ArrowRight' ? 1 : -1));}
    }}>
    <div className="photo-lightbox__frame" style={{width: `min(100%, 1100px, max(320px, calc((100dvh - 180px) * ${aspect})))`}}>
      <div className="photo-lightbox__toolbar">
        <span aria-live="polite">{active + 1} / {photos.length}</span>
        <a href={photos[active]} download={`collection-photo-${active + 1}.jpg`} aria-label="Скачать фото"><Download size={20} /></a>
        <button type="button" aria-label="Закрыть просмотр фотографий" onClick={onClose}><X size={22} /></button>
      </div>
      <div className="photo-lightbox__stage">
        <div className="photo-lightbox__image" style={{touchAction: zoom === 1 ? 'pan-y pinch-zoom' : 'auto'}}
          onPointerDown={event => {if (zoom === 1 && event.pointerType !== 'mouse') {start.current = {x: event.clientX, y: event.clientY}; event.currentTarget.setPointerCapture(event.pointerId);}}}
          onPointerCancel={() => {start.current = null;}}
          onPointerUp={event => {const origin = start.current; start.current = null; if (origin && Math.abs(event.clientX - origin.x) > 30 && Math.abs(event.clientX - origin.x) > Math.abs(event.clientY - origin.y)) select(active + (event.clientX < origin.x ? 1 : -1));}}>
          <img src={photos[active]} alt={`Фото ${active + 1}: ${title}`} draggable={false} onLoad={event => {const image = event.currentTarget; if (image.naturalHeight) setAspect(image.naturalWidth / image.naturalHeight);}} style={{width: `${zoom * 100}%`, height: `${zoom * 100}%`, maxWidth: 'none'}} />
        </div>
        {photos.length > 1 && <>
          <button type="button" className="photo-lightbox__prev" aria-label="Предыдущее фото" onClick={() => select(active - 1)}><ChevronLeft size={24} /></button>
          <button type="button" className="photo-lightbox__next" aria-label="Следующее фото" onClick={() => select(active + 1)}><ChevronRight size={24} /></button>
        </>}
        <div className="photo-lightbox__zoom">
          <button type="button" aria-label="Уменьшить фото" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .5))}><Minus size={20} /></button>
          <button type="button" aria-label="Сбросить масштаб" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
          <button type="button" aria-label="Увеличить фото" disabled={zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + .5))}><Plus size={20} /></button>
        </div>
      </div>
      {photos.length > 1 && <div className="photo-lightbox__thumbs" role="group" aria-label="Выбор фотографии">
        {photos.map((photo, position) => <button key={`${position}-${photo.slice(-24)}`} type="button" aria-label={`Показать фото ${position + 1}`} aria-pressed={position === active} onClick={() => select(position)}><img src={photo} alt="" /></button>)}
      </div>}
    </div>
  </dialog>, document.body);
}
