import { useState } from 'react';
import { cleanMoneyInput, formatMoneyInput } from '../../lib/moneyInput';

interface Props {id: string; value: string; onChange: (value: string) => void; invalid?: boolean; describedBy?: string}
/** Format on blur; keep the caret stable while the amount is being edited. */
export function MoneyInput({id, value, onChange, invalid = false, describedBy}: Props) {
  const [focused, setFocused] = useState(false);
  const [editingValue, setEditingValue] = useState('');
  return <div className="money-input">
    <input id={id} className="form-control" type="text" inputMode="decimal" autoComplete="off" maxLength={24}
      placeholder="Например, 4 990,00" value={focused ? editingValue : formatMoneyInput(value)}
      aria-invalid={invalid || undefined} aria-describedby={invalid ? describedBy : undefined}
      onFocus={event => {setEditingValue(event.currentTarget.value); setFocused(true);}} onBlur={() => setFocused(false)}
      onChange={event => {const next = cleanMoneyInput(event.target.value); if (next !== null) {setEditingValue(event.target.value); onChange(next);}}} />
    <span className="money-input__currency" aria-hidden="true">₽</span>
  </div>;
}
