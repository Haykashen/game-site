import { cx } from '../../lib/cx';
import { formatPrice } from '../../lib/formatPrice';
import type { Lot } from '../../types';

interface LotItemProps {
  lot: Lot;
}

/** Single listing row inside the modal. */
export function LotItem({ lot }: LotItemProps) {
  const isSale = lot.type === 'sale';
  const avatarClassName = isSale ? 'sales-avatar' : 'purchases-avatar';
  const priceClassName = isSale ? 'sales-price' : 'purchases-price';
  const pricePrefix = isSale ? '' : 'Купит за ';
  const actionLabel = isSale ? 'Связаться' : 'Предложить';
  const initial = lot.user.charAt(0).toUpperCase() || '?';

  return (
    <div className="lot-item">
      <div className="lot-info">
        <div className={cx('lot-avatar', avatarClassName)}>{initial}</div>
        <div>
          <p className="lot-title">{lot.title}</p>
          <p className="lot-sub">
            Состояние: {lot.condition} • Участник: {lot.user}
          </p>
        </div>
      </div>

      <div className="lot-price">
        <p className={priceClassName}>
          {pricePrefix}
          {formatPrice(lot.price)}
        </p>
        <button type="button" className="lot-action">
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
