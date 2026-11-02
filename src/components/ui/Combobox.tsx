import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface ComboboxOption { value: string; label: string }
interface Props {
  id: string;
  value: string;
  options: readonly ComboboxOption[];
  selectedValues: readonly string[];
  label: string;
  placeholder: string;
  required?: boolean;
  open: boolean;
  loading?: boolean;
  error?: string;
  emptyText: string;
  footer?: ReactNode;
  onOpen: () => void;
  onClose: () => void;
  onQueryChange: (query: string) => void;
  onSelect: (option: ComboboxOption) => void;
}

/** Shared listbox markup, keyboard navigation and active-option scrolling. */
export function Combobox({ id, value, options, selectedValues, label, placeholder, required = false,
  open, loading = false, error, emptyText, footer, onOpen, onClose, onQueryChange, onSelect }: Props) {
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(-1);
  const available = !loading && !error;
  useEffect(() => { setActive(-1); }, [options, open]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  const activeOption = available && open ? options[active] : undefined;

  return <div className="series-combobox">
    <input id={id} className="form-control" role="combobox" autoComplete="off"
      aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
      aria-activedescendant={activeOption ? listId + '-' + active : undefined}
      placeholder={placeholder} required={required} value={value}
      onFocus={onOpen} onClick={() => { if (!open) onOpen(); }} onBlur={onClose}
      onChange={event => { onQueryChange(event.target.value); setActive(-1); }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (!open) onOpen();
          if (available) setActive(index => event.key === 'ArrowDown'
            ? Math.min(index + 1, options.length - 1)
            : index < 0 ? options.length - 1 : Math.max(index - 1, 0));
        } else if (event.key === 'Enter' && open) {
          event.preventDefault();
          if (activeOption) { onSelect(activeOption); setActive(-1); }
        } else if (event.key === 'Escape' && open) {
          event.preventDefault(); event.stopPropagation(); onClose(); setActive(-1);
        }
      }} />
    {open && <div className="series-combobox__list" ref={listRef} id={listId} role="listbox" aria-label={label}>
      {loading ? <p role="status">Загружаем…</p> : error ? <p role="alert">{error}</p> : <>
        {options.map((option, index) => <button type="button" role="option" key={option.value}
          id={listId + '-' + index} aria-selected={selectedValues.includes(option.value)}
          data-active={index === active} className={index === active ? 'is-active' : ''}
          onMouseDown={event => event.preventDefault()} onClick={() => { onSelect(option); setActive(-1); }}>{option.label}</button>)}
        {!options.length && <p>{emptyText}</p>}
        {footer}
      </>}
    </div>}
  </div>;
}
