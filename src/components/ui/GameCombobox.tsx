import { useEffect, useId, useRef, useState } from 'react';
import type { Game } from '../../types';

interface GameComboboxProps {
  id: string;
  games: readonly Game[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}

/** Searchable game selection; typing never silently selects a catalogue entry. */
export function GameCombobox({ id, games, value, onChange, required = false }: GameComboboxProps) {
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const selected = games.find(game => game.id === value);
  const normalizedQuery = query.trim().toLocaleLowerCase('ru-RU');
  const matches = games.filter(game => game.title.toLocaleLowerCase('ru-RU').includes(normalizedQuery));
  const visible = matches.slice(0, 50);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (gameId: string) => {
    onChange(gameId);
    setOpen(false);
    setQuery('');
    setActive(-1);
  };

  return <div className="series-combobox">
    <input id={id} className="form-control" role="combobox" autoComplete="off"
      aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
      aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
      placeholder="Найти игру…" required={required}
      value={open ? query : selected?.title ?? ''}
      onFocus={() => { setOpen(true); setQuery(''); setActive(-1); }}
      onClick={() => setOpen(true)}
      onBlur={() => { setOpen(false); setQuery(''); setActive(-1); }}
      onChange={event => { setQuery(event.target.value); onChange(''); setOpen(true); setActive(-1); }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); setOpen(true);
          setActive(index => event.key === 'ArrowDown'
            ? Math.min(index + 1, visible.length - 1)
            : index < 0 ? visible.length - 1 : Math.max(index - 1, 0));
        } else if (event.key === 'Enter' && open) {
          event.preventDefault();
          if (active >= 0 && visible[active]) choose(visible[active]!.id);
        } else if (event.key === 'Escape' && open) {
          event.preventDefault(); event.stopPropagation(); setOpen(false); setQuery(''); setActive(-1);
        }
      }} />
    {open && <div className="series-combobox__list" ref={listRef} id={listId} role="listbox" aria-label="Игры">
      {visible.map((game, index) => <button type="button" role="option" key={game.id}
        id={`${listId}-${index}`} aria-selected={game.id === value} data-active={index === active}
        className={index === active ? 'is-active' : ''}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(game.id)}>{game.title}</button>)}
      {!visible.length && <p>{games.length ? 'Игры не найдены' : 'Каталог пока недоступен'}</p>}
      {matches.length > visible.length && <p>Показаны первые 50 игр. Уточните название.</p>}
    </div>}
  </div>;
}
