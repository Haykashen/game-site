import { PlatformBadge } from '../ui/PlatformBadge';
import { CollectionCountBadge } from '../ui/CollectionCountBadge';
import { formatMarketCondition } from '../../lib/market';
import {
  ExternalLink,
  Image as ImageIcon,
  Package,
  Pencil,
  Trash2,
  Wallet,
} from 'lucide-react';
import { PhotoPreviewGallery } from '../ui/PhotoPreviewGallery';
import { formatPurchaseDetails } from '../../lib/collection';
import { editionContentsLabel, editionLabel, formatEditionDate } from '../../lib/editions';
import type { Copy, Edition, Game } from '../../types';

interface CopyCardProps {
  copy: Copy;
  edition: Edition;
  game: Game;
  quantity: number;
  photos?: readonly string[];
  onOpen: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

/** One owned edition; quantity is the number of identical physical copies. */
export function CopyCard({
  copy,
  edition,
  game,
  quantity,
  photos = copy.photos,
  onOpen,
  onEdit,
  onRemove,
}: CopyCardProps) {
  const images = [...new Set(photos.filter(Boolean))];
  const displayEdition = {...edition, region: copy.region ?? edition.region};
  const purchase = formatPurchaseDetails(copy.purchasePrice, copy.purchaseDate);
  const chips = [formatMarketCondition(copy.condition), copy.completeness].filter(
    (value, index, all) => value.length > 0 && all.indexOf(value) === index,
  );

  return (
    <article className="copy-card" onClick={event => {
      const target = event.target;
      if (!(target instanceof Element) || target.closest('button, a, input, select, textarea, [role="button"], [role="link"]')) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && event.currentTarget.contains(selection.anchorNode)) return;
      onOpen();
    }}>
      <div className="copy-card__cover">
        {images.length > 0 ? (
          <PhotoPreviewGallery photos={images} title={`Фотография экземпляра ${game.title}`} />
        ) : (
          <div className="copy-card__placeholder">
            <ImageIcon size={28} aria-hidden="true" />
            <span>{edition.platform}</span>
          </div>
        )}
        <div className="card-platforms"><PlatformBadge platform={edition.platform} /></div>
        <CollectionCountBadge count={quantity} />
      </div>

      <div className="copy-card__body">
        <div>
          <h3 className="copy-card__title">{game.title}</h3>
          <p className="copy-card__edition">{editionLabel(displayEdition)}</p>
        </div>

        <div className="copy-card__chips">
          {chips.map((chip) => (
            <span className="edition-chip" key={chip}>
              {chip}
            </span>
          ))}
          {edition.releaseDate && (
            <span className="edition-chip">{formatEditionDate(edition.releaseDate)}</span>
          )}
        </div>

        <p className="copy-card__contents">
          <Package size={13} aria-hidden="true" />
          <span>{editionContentsLabel(edition, 3)}</span>
        </p>

        {purchase && (
          <p className="copy-card__purchase">
            <Wallet size={13} aria-hidden="true" />
            <span>{purchase}</span>
          </p>
        )}

        {copy.notes && <p className="copy-card__notes">{copy.notes}</p>}

        <div className="copy-card__actions">
          <button type="button" className="copy-card__open" onClick={onOpen}>
            <ExternalLink size={14} aria-hidden="true" />
            Открыть экземпляр
          </button>
          <button
            type="button"
            className="copy-card__edit"
            aria-label={`Редактировать ${game.title} (${editionLabel(displayEdition)})`}
            onClick={onEdit}
          >
            <Pencil size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="copy-card__remove"
            aria-label={`Убрать ${game.title} (${editionLabel(displayEdition)}) с полки`}
            onClick={onRemove}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
