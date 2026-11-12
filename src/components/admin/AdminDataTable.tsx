import { LoadingState } from '../LoadingState';
import { ArrowDown, ArrowUp, ArrowUpDown, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Columns3 } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { useAuth } from '../../context/AuthContext';

export interface AdminColumn<T, K extends string = string> {
  key: K;
  label: string;
  render: (record: T) => ReactNode;
  filter?: ReactNode;
  sortable?: boolean;
}
interface Props<T, K extends string> {
  label: string;
  columns: AdminColumn<T, K>[];
  rows: readonly T[];
  rowKey: (record: T) => string;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: K) => void;
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  onReset: () => void;
  hasFilters: boolean;
  actions?: (record: T) => ReactNode;
  onSelect?: (record: T) => void;
  selectedKey?: string;
  compact?: boolean;
  storageKey?: string;
}

/** The single table renderer for users and every database model. Data loading stays with the page. */
export function AdminDataTable<T, K extends string = string>({label, columns, rows, rowKey, sortBy, sortDir, onSort, loading, total, page, pageSize, onPage, onReset, hasFilters, actions, onSelect, selectedKey, compact, storageKey}: Props<T, K>) {
  const {user} = useAuth();
  const preferenceKey = 'discvault:table-columns:' + (user?.id ?? 'guest') + ':' + (storageKey ?? label);
  const readHidden = (key: string): string[] => {try {const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];} catch {return [];}};
  const [preferences, setPreferences] = useState(() => ({key: preferenceKey, hidden: readHidden(preferenceKey)}));
  const [columnsOpen, setColumnsOpen] = useState(false);
  useEffect(() => {setPreferences({key: preferenceKey, hidden: readHidden(preferenceKey)}); setColumnsOpen(false);}, [preferenceKey]);
  const hidden = preferences.key === preferenceKey ? preferences.hidden : readHidden(preferenceKey);
  const visibleColumns = columns.filter(column => !hidden.includes(column.key));
  const displayedColumns = visibleColumns.length ? visibleColumns : columns;
  function saveHidden(next: string[]) {setPreferences({key: preferenceKey, hidden: next}); try {localStorage.setItem(preferenceKey, JSON.stringify(next));} catch {/* Storage may be unavailable; keep the session preference. */}}
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <>
    <div className="panel analytics-table-panel admin-users__panel">
      <div className="admin-users__table-toolbar" aria-live="polite">
        <span>{loading ? (rows.length > 0 ? <LoadingState variant="inline" message="Обновляем записи…" /> : 'Записи') : `Всего: ${total.toLocaleString('ru-RU')}`}</span>
        {hasFilters && <button type="button" className="btn-secondary" onClick={onReset}><X size={14} />Сбросить фильтры</button>}
        <IconButton label="Видимость столбцов" title="Видимость столбцов" aria-expanded={columnsOpen} onClick={() => setColumnsOpen(value => !value)}><Columns3 size={20} /></IconButton>
      </div>
      {columnsOpen && <fieldset className="admin-table-columns"><legend>Видимые столбцы</legend>
        {columns.map(column => <label key={column.key}><input type="checkbox" checked={displayedColumns.some(item => item.key === column.key)} disabled={displayedColumns.length === 1 && displayedColumns[0]?.key === column.key} onChange={event => saveHidden(event.target.checked ? hidden.filter(key => key !== column.key) : [...hidden, column.key])} />{column.label}</label>)}
        <button type="button" className="btn-secondary" onClick={() => saveHidden([])}>Показать все</button>
      </fieldset>}
      <div className={`analytics-table-wrap${compact ? ' admin-data__scroll--compact' : ''}`} aria-busy={loading}>
        <table className="analytics-table admin-users__table admin-data__table" aria-label={label}>
          <thead>
            <tr>{displayedColumns.map((column) => <th key={column.key} scope="col" aria-sort={sortBy === column.key ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}>
              {column.sortable === false ? column.label : <button type="button" className={`admin-users__sort${sortBy === column.key ? ' is-active' : ''}`} onClick={() => onSort(column.key)}>
                {column.label}{sortBy === column.key ? sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ArrowUpDown size={13} />}
              </button>}
            </th>)}{actions && <th scope="col" className="admin-data__actions">Действия</th>}</tr>
            <tr className="admin-users__column-filters">{columns.map((column) => <th key={column.key}>{column.filter}</th>)}{actions && <th className="admin-data__actions" />}</tr>
          </thead>
          <tbody>{!rows.length ? <tr><td colSpan={displayedColumns.length + (actions ? 1 : 0)}><div className="admin-users__empty-row">
            {loading ? <LoadingState variant="inline" message="Загружаем записи…" /> : 'По выбранным фильтрам записи не найдены.'}
          </div></td></tr> : rows.map((record) => <tr key={rowKey(record)}
            className={onSelect ? `admin-data__selectable${selectedKey === rowKey(record) ? ' is-selected' : ''}` : undefined}
            aria-selected={onSelect ? selectedKey === rowKey(record) : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onClick={onSelect ? (event) => {if (event.target instanceof Element && !event.target.closest('a,button,input,select,textarea,summary')) onSelect(record);} : undefined}
            onKeyDown={onSelect ? (event) => {if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {event.preventDefault(); onSelect(record);}} : undefined}>
            {columns.map((column) => <td key={column.key}>{typeof (record as Record<string, unknown>)['__reference_' + column.key] === 'string' ? <span className="admin-data__cell" title={String((record as Record<string, unknown>)[column.key] ?? '')}>{String((record as Record<string, unknown>)['__reference_' + column.key])}</span> : column.render(record)}</td>)}
            {actions && <td className="admin-data__actions"><div className="admin-data__row-actions">{actions(record)}</div></td>}
          </tr>)}</tbody>
        </table>
      </div>
    </div>
    {(page > 1 || total > pageSize) && <div className="admin-users__pagination">
      <button type="button" className="btn-secondary" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>Назад</button>
      <span>Страница {page} из {pages}</span>
      <button type="button" className="btn-secondary" disabled={page >= pages || loading} onClick={() => onPage(page + 1)}>Далее</button>
    </div>}
  </>;
}
