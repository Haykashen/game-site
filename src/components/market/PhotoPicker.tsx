import { ImagePlus, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { MAX_MARKET_PHOTOS } from '../../lib/constants';
import { cx } from '../../lib/cx';
import { prepareMarketPhoto } from '../../lib/photos';

interface PhotoPickerProps {
  photos: readonly string[];
  onChange: (photos: string[]) => void;
  /** Lets the form block submission while images are still being compressed. */
  onBusyChange?: (isBusy: boolean) => void;
}

/** Uploads and previews seller photos; files are compressed before being stored. */
export function PhotoPicker({ photos, onChange, onBusyChange }: PhotoPickerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const updateProcessing = (isBusy: boolean) => {
    setIsProcessing(isBusy);
    onBusyChange?.(isBusy);
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    const remaining = MAX_MARKET_PHOTOS - photos.length;

    if (remaining <= 0) {
      setError(`Можно приложить не больше ${MAX_MARKET_PHOTOS} фото.`);
      return;
    }

    const selectedFiles = files.slice(0, remaining);
    let nextError =
      files.length > remaining
        ? `Лимит — ${MAX_MARKET_PHOTOS} фото. Лишние файлы не добавлены.`
        : '';

    updateProcessing(true);
    const prepared: string[] = [];

    for (const file of selectedFiles) {
      try {
        prepared.push(await prepareMarketPhoto(file));
      } catch (cause) {
        if (!nextError) {
          nextError = cause instanceof Error ? cause.message : 'Не удалось обработать фото.';
        }
      }
    }

    updateProcessing(false);
    setError(nextError);

    if (prepared.length > 0) {
      onChange([...photos, ...prepared]);
    }
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, photoIndex) => photoIndex !== index));
    setError('');
  };

  return (
    <div className="market-photo-picker" aria-busy={isProcessing}>
      <div className="market-photo-picker__head">
        <span className="form-label">Фотографии</span>
        <span className="market-photo-picker__count">
          {photos.length} / {MAX_MARKET_PHOTOS}
        </span>
      </div>

      <div className="market-photo-picker__grid">
        {photos.map((photo, index) => (
          <div className="market-photo-tile" key={`${index}-${photo.slice(-24)}`}>
            <img src={photo} alt={`Фото ${index + 1}`} />
            <button
              type="button"
              aria-label={`Удалить фото ${index + 1}`}
              disabled={isProcessing}
              onClick={() => removePhoto(index)}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}

        {photos.length < MAX_MARKET_PHOTOS && (
          <label className={cx('market-photo-add', isProcessing && 'is-disabled')}>
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={isProcessing}
              onChange={handleFiles}
            />
            {isProcessing ? (
              <Loader2 className="market-photo-spin" size={20} aria-hidden="true" />
            ) : (
              <ImagePlus size={20} aria-hidden="true" />
            )}
            <span>{isProcessing ? 'Обработка…' : 'Добавить фото'}</span>
          </label>
        )}
      </div>

      <p className="market-photo-picker__hint">
        До {MAX_MARKET_PHOTOS} фото, каждое до 10 МБ. Изображения сжимаются автоматически.
      </p>

      {error && (
        <p className="market-photo-picker__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
