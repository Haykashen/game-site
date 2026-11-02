import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { AdminReference } from '@discvault/shared';
import { fetchAdminReferences } from '../../api/adminData';
import { errorMessage } from '../../api/client';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { Combobox } from '../ui/Combobox';

const nameOf = (item: AdminReference) => item.label.split(' · ')[0] ?? item.label;
interface Props {
  value: string;
  onChange: (value: string) => void;
  inputId: string;
  required: boolean;
  reference: string;
  entity?: string | undefined;
  multiple?: boolean;
  selectedNames?: Record<string, string>;
}

export function ReferenceCombobox({ value, onChange, inputId, required, reference, entity,
  multiple = false, selectedNames = {} }: Props) {
  const [text, setText] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [labels, setLabels] = useState<Record<string, string>>(selectedNames);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AdminReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const query = useDebouncedValue(text);
  const selected = useMemo(() => value.split('\n').filter(Boolean), [value]);

  useEffect(() => {
    if (multiple) return;
    if (!value) { setSelectedLabel(''); return; }
    const controller = new AbortController();
    void fetchAdminReferences(reference, value, controller.signal, entity).then(result => {
      if (controller.signal.aborted) return;
      const item = result.items.find(item => item.value === value);
      if (item) { setSelectedLabel(nameOf(item)); setText(nameOf(item)); }
    }).catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => controller.abort();
  }, [value, reference, multiple, entity]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError('');
    void fetchAdminReferences(reference, query, controller.signal, entity).then(result => {
      if (controller.signal.aborted) return;
      setOptions(result.items);
      setLabels(previous => ({ ...previous, ...Object.fromEntries(result.items.map(item => [item.value, nameOf(item)])) }));
    }).catch(cause => {
      if (!controller.signal.aborted) setError(errorMessage(cause));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, open, reference, entity]);

  const visible = useMemo(() => [
    ...(!multiple && !required ? [{ value: '', label: 'Не указано' }] : []),
    ...options.filter(item => !multiple || !selected.includes(item.value)).map(item => ({ value: item.value, label: nameOf(item) })),
  ], [multiple, required, options, selected]);
  const close = () => { setOpen(false); setText(multiple ? '' : selectedLabel); };
  const choose = (item: AdminReference) => {
    if (multiple) {
      if (!selected.includes(item.value)) onChange([...selected, item.value].join('\n'));
      setLabels(previous => ({ ...previous, [item.value]: item.label })); setText('');
    } else {
      onChange(item.value);
      setText(item.value ? item.label : ''); setSelectedLabel(item.value ? item.label : '');
    }
    setOpen(false);
  };
  const isStatus = reference === 'Status' || reference.endsWith('Status');
  const placeholder = multiple ? 'Найти жанр…' : reference === 'Region' ? 'Найти регион…' : isStatus ? 'Найти статус…' : 'Найти серию…';
  const label = multiple ? 'Жанры игр' : reference === 'Region' ? 'Регионы' : isStatus ? 'Статусы' : 'Серии игр';

  return <div>
    <Combobox id={inputId} value={text} options={visible} selectedValues={selected}
      label={label} placeholder={placeholder} required={!multiple && required}
      open={open} loading={loading || query !== text} error={error} emptyText="Нет подходящих вариантов"
      onOpen={() => { setOpen(true); if (!multiple) setText(''); }} onClose={close}
      onQueryChange={next => { setText(next); if (!multiple) { setSelectedLabel(''); onChange(''); } setOpen(true); }}
      onSelect={choose} />
    {multiple && <div className="reference-tags" aria-label="Выбранные жанры">
      {selected.map(key => <span className="reference-tags__item" key={key}>
        {labels[key] ?? selectedNames[key] ?? key}
        <button type="button" aria-label={'Убрать жанр ' + (labels[key] ?? selectedNames[key] ?? key)}
          onClick={() => onChange(selected.filter(item => item !== key).join('\n'))}><X size={14} aria-hidden="true" /></button>
      </span>)}
    </div>}
    {!open && error && <small role="alert">{error}</small>}
  </div>;
}
