import { Minus, Plus } from 'lucide-react';
import { MAX_COLLECTION_QUANTITY } from '../../lib/constants';
interface Props {quantity: number; disabled?: boolean; onChange: (quantity: number) => void}
/** The collection quantity stepper lives on the copy detail, beside its other fields. */
export function QuantityControl({quantity, disabled = false, onChange}: Props) {
  return <div className="collection-quantity" role="group" aria-label="Количество экземпляров">
    <span className="collection-quantity__label">Количество</span>
    <div className="collection-quantity__stepper">
      <button type="button" aria-label="Уменьшить количество" disabled={disabled || quantity <= 1} onClick={() => onChange(quantity - 1)}><Minus size={14} aria-hidden="true" /></button>
      <span className="collection-quantity__value" aria-live="polite">{quantity}</span>
      <button type="button" aria-label="Увеличить количество" disabled={disabled || quantity >= MAX_COLLECTION_QUANTITY} onClick={() => onChange(quantity + 1)}><Plus size={14} aria-hidden="true" /></button>
    </div>
  </div>;
}
