interface Props { id: string; value: string; disabled?: boolean; onChange: (value: string) => void }
/** Shared ten-point condition input for collection creation and editing. */
export function ConditionInput({id, value, disabled, onChange}: Props) {
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)(?:\s*\/\s*10)?$/);
  const score = match && Number(match[1]!.replace(',', '.')) <= 10 ? match[1]!.replace(',', '.') : '';
  return <span className="condition-input"><input id={id} className="game-detail__score" type="number" min={0} max={10} step={1} inputMode="numeric" placeholder="—" aria-label="Состояние экземпляра от 0 до 10" value={score} disabled={disabled} onChange={event => {const next = event.target.value; if(next === '' || Number(next) >= 0 && Number(next) <= 10) onChange(next);}} /><span aria-hidden="true">/10</span></span>;
}
