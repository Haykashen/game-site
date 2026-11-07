import { useMemo, useState } from 'react';
import { COMPLETENESS_OPTIONS } from '../../lib/filterOptions';
import { Combobox } from '../ui/Combobox';

interface Props {id: string; value: string; onChange: (value: string) => void}
/** Uses the same searchable listbox as the game-series picker. Stored values remain unchanged. */
export function CompletenessCombobox({id, value, onChange}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selectedValue = value === 'Не указано' ? '' : value;
  const options = useMemo(() => [
    {value: '', label: 'Не указано'},
    ...COMPLETENESS_OPTIONS,
    ...(selectedValue && !COMPLETENESS_OPTIONS.some(option => option.value === selectedValue)
      ? [{value: selectedValue, label: selectedValue}] : []),
  ], [selectedValue]);
  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('ru-RU');
    return options.filter(option => option.label.toLocaleLowerCase('ru-RU').includes(search));
  }, [options, query]);
  const selected = options.find(option => option.value === selectedValue);
  const close = () => {setOpen(false); setQuery('');};
  return <Combobox id={id} value={open ? query : selected?.label ?? ''}
    options={visible} selectedValues={[selectedValue]} label="Комплектность"
    placeholder="Найти комплектность…" emptyText="Варианты не найдены"
    open={open} onOpen={() => {setOpen(true); setQuery('');}} onClose={close}
    onQueryChange={text => {setQuery(text); setOpen(true);}}
    onSelect={option => {onChange(option.value); close();}} />;
}
