import { ChevronLeft, ChevronRight, Images } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MAX_MARKET_PHOTOS } from '../../lib/constants';
import { cx } from '../../lib/cx';

interface MarketPhotoGalleryProps {
  photos: readonly string[];
  title: string;
}

/** Entity-card gallery: a carousel with thumbnails, or a slot prompt when empty. */
export function MarketPhotoGallery({ photos, title }: MarketPhotoGalleryProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [photos]);

  if (photos.length === 0) {
    return (
      <div className="market-photo-empty">
        <Images size={24} aria-hidden="true" />
        <span className="market-photo-empty__title">Фотографии не добавлены</span>
        <p>
          При размещении автор может приложить до {MAX_MARKET_PHOTOS} фото — они появятся
          здесь каруселью.
        </p>
      </div>
    );
  }

  const safeIndex = Math.min(index, photos.length - 1);
  const hasSeveral = photos.length > 1;

  const move = (step: number) => {
    setIndex((current) => (current + step + photos.length) % photos.length);
  };

  return (
    <figure className="market-carousel">
      <div className="market-carousel__stage">
        <img
          src={photos[safeIndex]}
          alt={`Фото ${safeIndex + 1} из ${photos.length}: ${title}`}
        />

        {hasSeveral && (
          <>
            <button
              type="button"
              className="market-carousel__nav market-carousel__nav--prev"
              aria-label="Предыдущее фото"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="market-carousel__nav market-carousel__nav--next"
              aria-label="Следующее фото"
              onClick={() => move(1)}
            >
              <ChevronRight size={20} aria-hidden="true" />
            </button>
            <span className="market-carousel__counter" aria-live="polite">
              {safeIndex + 1} / {photos.length}
            </span>
          </>
        )}
      </div>

      {hasSeveral && (
        <div className="market-carousel__thumbs" role="group" aria-label="Фотографии лота">
          {photos.map((photo, photoIndex) => (
            <button
              key={`${photoIndex}-${photo.slice(-24)}`}
              type="button"
              className={cx(
                'market-carousel__thumb',
                photoIndex === safeIndex && 'is-active',
              )}
              aria-label={`Показать фото ${photoIndex + 1}`}
              aria-pressed={photoIndex === safeIndex}
              onClick={() => setIndex(photoIndex)}
            >
              <img src={photo} alt="" />
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}
