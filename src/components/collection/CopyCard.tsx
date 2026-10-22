import {
  ExternalLink,
  Image as ImageIcon,
  Minus,
  Package,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import { formatPurchaseDetails } from '../../lib/collection';
import { MAX_COLLECTION_QUANTITY } from '../../lib/constants';
import { editionContentsLabel, editionLabel, formatEditionDate } from '../../lib/editions';
import type { Copy, Edition, Game } from '../../types';

interface CopyCardProps {
  copy: Copy;
  edition: Edition;
  game: Game;
  quantity: number;
  onOpen: () => void;
  onEdit: () => void;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}

/** One owned edition; quantity is the number of identical physical copies. */
export function CopyCard({
  copy,
  edition,
  game,
  quantity,
  onOpen,
  onEdit,
  onQuantityChange,
  onRemove,
}: CopyCardProps) {
  const cover = edition.coverImages[0];
  const purchase = formatPurchaseDetails(copy.purchasePrice, copy.purchaseDate);
  const chips = [copy.condition, copy.completeness].filter(
    (value, index, all) => value.length > 0 && all.indexOf(value) === index,
  );

  return (
    <article className="copy-card">
      <div className="copy-card__cover">
        {cover ? (
          <img src={cover} alt="" loading="lazy" />
        ) : (
          <div className="copy-card__placeholder">
            <ImageIcon size={28} aria-hidden="true" />
            <span>{edition.platform}</span>
          </div>
        )}
        <span className="badge-platform badge-platform--static copy-card__badge">
          {edition.platform}
        </span>
        <span className="copy-card__count" aria-label={`Количество: ${quantity}`}>
          ×{quantity}
        </span>
      </div>

      <div className="copy-card__body">
        <div>
          <h3 className="copy-card__title">{game.title}</h3>
          <p className="copy-card__edition">{editionLabel(edition)}</p>
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

        <div className="copy-card__quantity">
          <span className="copy-card__quantity-label">Количество</span>
          <div className="copy-card__stepper">
            <button
              type="button"
              aria-label="Уменьшить количество"
              disabled={quantity <= 1}
              onClick={() => onQuantityChange(quantity - 1)}
            >
              <Minus size={14} aria-hidden="true" />
            </button>
            <span className="copy-card__quantity-value" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Увеличить количество"
              disabled={quantity >= MAX_COLLECTION_QUANTITY}
              onClick={() => onQuantityChange(quantity + 1)}
            >
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="copy-card__actions">
          <button type="button" className="copy-card__open" onClick={onOpen}>
            <ExternalLink size={14} aria-hidden="true" />
            Открыть игру
          </button>
          <button
            type="button"
            className="copy-card__edit"
            aria-label={`Редактировать ${game.title} (${editionLabel(edition)})`}
            onClick={onEdit}
          >
            <Pencil size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="copy-card__remove"
            aria-label={`Убрать ${game.title} (${editionLabel(edition)}) с полки`}
            onClick={onRemove}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
