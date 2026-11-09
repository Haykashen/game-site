import { ImagePlus, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent } from 'react';
import { MAX_MARKET_PHOTOS } from '../../lib/constants';
import { cx } from '../../lib/cx';
import { prepareMarketPhoto } from '../../lib/photos';
import { reorderPhoto } from '../../lib/copyEditor';

interface PhotoPickerProps {
  photos: readonly string[];
  onChange: (photos: string[]) => void;
  onBusyChange?: (isBusy: boolean) => void;
  readOnly?: boolean;
  disabled?: boolean;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  sortable?: boolean;
}

/** One upload/thumbnail component for forms and the editable collection gallery. */
export function PhotoPicker({ photos, onChange, onBusyChange, readOnly = false, disabled = false, selectedIndex, onSelect, sortable = false }: PhotoPickerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const drag = useRef<{index: number; x: number; y: number; moved: boolean; target: number} | null>(null);
  const suppressClick = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  const locked = disabled || isProcessing;
  const canSort = sortable && !readOnly && !locked;

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (readOnly || locked || !files.length) return;
    const remaining = MAX_MARKET_PHOTOS - photos.length;
    if (remaining <= 0) {setError(`Можно приложить не больше ${MAX_MARKET_PHOTOS} фото.`); return;}
    let nextError = files.length > remaining ? `Лимит — ${MAX_MARKET_PHOTOS} фото. Лишние файлы не добавлены.` : '';
    setIsProcessing(true); onBusyChange?.(true);
    const prepared: string[] = [];
    try {
      for (const file of files.slice(0, remaining)) {
        try {prepared.push(await prepareMarketPhoto(file));}
        catch (cause) {nextError ||= cause instanceof Error ? cause.message : 'Не удалось обработать фото.';}
      }
      if (mounted.current) {
        if (prepared.length) onChange([...photos, ...prepared]);
        setError(nextError);
      }
    } finally {if (mounted.current) {setIsProcessing(false); onBusyChange?.(false);}}
  };
  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current; drag.current = null; setDropIndex(null);
    if (!current?.moved) return;
    suppressClick.current = Date.now() + 350;
    if (event.type !== 'pointercancel' && canSort) onChange(reorderPhoto(photos, current.index, current.target));
  };
  return <div className={cx('market-photo-picker', onSelect && 'photo-strip', readOnly && 'photo-strip--readonly')} aria-busy={isProcessing}>
    <div className="market-photo-picker__head"><span className="form-label">Фотографии</span><span className="market-photo-picker__count" aria-live="polite" aria-atomic="true" aria-label={onSelect ? `Фото ${photos.length ? Math.min(Math.max(selectedIndex ?? 0, 0), photos.length - 1) + 1 : 0} из ${photos.length}` : `Фотографий: ${photos.length}`} >{onSelect ? `${photos.length ? Math.min(Math.max(selectedIndex ?? 0, 0), photos.length - 1) + 1 : 0} / ${photos.length}` : <>{photos.length}{!readOnly && ` / ${MAX_MARKET_PHOTOS}`}</>}</span></div>
    <div className="market-photo-picker__grid" role="group" aria-label="Фотографии экземпляра">
      {photos.map((photo, index) => <div className={cx('market-photo-tile', index === selectedIndex && 'is-selected', index === dropIndex && 'is-drop-target')} data-photo-index={index} key={`${index}-${photo.slice(-24)}`}>
        {onSelect ? <button type="button" className={cx('photo-strip__select', canSort && 'is-sortable')} aria-label={`Показать фото ${index + 1}`} aria-pressed={index === selectedIndex}
          onClick={() => {if (Date.now() > suppressClick.current) onSelect(index);}}
          onKeyDown={event => {
            if (!canSort || !event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault(); onChange(reorderPhoto(photos, index, index + (event.key === 'ArrowRight' ? 1 : -1)));
          }}
          onPointerDown={event => {
            if (!canSort || event.button !== 0) return;
            drag.current = {index, x: event.clientX, y: event.clientY, moved: false, target: index};
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={event => {
            const current = drag.current;
            if (!current || !canSort || (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 8)) return;
            current.moved = true;
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-photo-index]');
            // Only reorder tiles within this picker, never those in another open form.
            const row = event.currentTarget.closest('.market-photo-picker__grid');
            const targetIndex = target && row?.contains(target) ? Number(target.dataset.photoIndex) : index;
            current.target = targetIndex; setDropIndex(targetIndex);
          }} onPointerUp={finishDrag} onPointerCancel={finishDrag}>
          <img src={photo} alt="" draggable={false} />
        </button> : <img src={photo} alt={`Фото ${index + 1}`} />}
        {!readOnly && <button type="button" className="photo-strip__remove" aria-label={`Удалить фото ${index + 1}`} disabled={locked} onClick={() => {onChange(photos.filter((_, position) => position !== index)); setError('');}}><X size={14} aria-hidden="true" /></button>}
      </div>)}
      {!readOnly && photos.length < MAX_MARKET_PHOTOS && <label className={cx('market-photo-add', locked && 'is-disabled')}>
        <input type="file" accept="image/*" multiple disabled={locked} aria-label="Добавить фотографии" onChange={handleFiles} />
        {isProcessing ? <Loader2 className="market-photo-spin" size={20} aria-hidden="true" /> : <ImagePlus size={20} aria-hidden="true" />}<span>{isProcessing ? 'Обработка…' : 'Добавить фото'}</span>
      </label>}
    </div>
    {!readOnly && <p className="market-photo-picker__hint">До {MAX_MARKET_PHOTOS} фото, каждое до 10 МБ. Изображения сжимаются автоматически.{sortable && ' Перетащите миниатюры, чтобы изменить порядок. С клавиатуры: Alt + ← / →.'}</p>}
    {!readOnly && error && <p className="market-photo-picker__error" role="alert">{error}</p>}
  </div>;
}
