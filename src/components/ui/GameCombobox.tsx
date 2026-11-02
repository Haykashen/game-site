import { useMemo, useState } from 'react';
import type { Game } from '../../types';
import { Combobox } from './Combobox';

interface GameComboboxProps {
  id: string;
  games: readonly Game[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}

/** Local catalogue adapter; typing never silently selects a game. */
export function GameCombobox({ id, games, value, onChange, required = false }: GameComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selected = games.find(game => game.id === value);
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru-RU');
    return games.filter(game => game.title.toLocaleLowerCase('ru-RU').includes(normalized));
  }, [games, query]);
  const options = useMemo(() => matches.slice(0, 50).map(game => ({ value: game.id, label: game.title })), [matches]);
  const close = () => { setOpen(false); setQuery(''); };
  return <Combobox id={id} value={open ? query : selected?.title ?? ''} options={options}
    selectedValues={[value]} label="Игры" placeholder="Найти игру…" required={required}
    open={open} onOpen={() => { setOpen(true); setQuery(''); }} onClose={close}
    onQueryChange={text => { setQuery(text); onChange(''); setOpen(true); }}
    onSelect={option => { onChange(option.value); close(); }}
    emptyText={games.length ? 'Игры не найдены' : 'Каталог пока недоступен'}
    footer={matches.length > options.length ? <p>Показаны первые 50 игр. Уточните название.</p> : null} />;
}
