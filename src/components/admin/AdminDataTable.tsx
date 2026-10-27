import { ArrowDown, ArrowUp, ArrowUpDown, RefreshCw, X } from 'lucide-react';
import type { ReactNode } from 'react';

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
}

/** The single table renderer for users and every database model. Data loading stays with the page. */
export function AdminDataTable<T, K extends string = string>({label, columns, rows, rowKey, sortBy, sortDir, onSort, loading, total, page, pageSize, onPage, onReset, hasFilters, actions}: Props<T, K>) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return <>
    <div className="panel analytics-table-panel admin-users__panel">
      <div className="admin-users__table-toolbar" aria-live="polite">
        <span>{loading ? 'Загружаем…' : `Всего: ${total.toLocaleString('ru-RU')}`}</span>
        {hasFilters && <button type="button" className="btn-secondary" onClick={onReset}><X size={14} />Сбросить фильтры</button>}
      </div>
      <div className="analytics-table-wrap" aria-busy={loading}>
        <table className="analytics-table admin-users__table admin-data__table" aria-label={label}>
          <thead>
            <tr>{columns.map((column) => <th key={column.key} scope="col" aria-sort={sortBy === column.key ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}>
              {column.sortable === false ? column.label : <button type="button" className={`admin-users__sort${sortBy === column.key ? ' is-active' : ''}`} onClick={() => onSort(column.key)}>
                {column.label}{sortBy === column.key ? sortDir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} /> : <ArrowUpDown size={13} />}
              </button>}
            </th>)}{actions && <th scope="col" className="admin-data__actions">Действия</th>}</tr>
            <tr className="admin-users__column-filters">{columns.map((column) => <th key={column.key}>{column.filter}</th>)}{actions && <th className="admin-data__actions" />}</tr>
          </thead>
          <tbody>{!rows.length ? <tr><td colSpan={columns.length + (actions ? 1 : 0)}><div className="admin-users__empty-row">
            {loading && <RefreshCw className="market-photo-spin" size={18} />}{loading ? 'Загружаем записи…' : 'По выбранным фильтрам записи не найдены.'}
          </div></td></tr> : rows.map((record) => <tr key={rowKey(record)}>
            {columns.map((column) => <td key={column.key}>{column.render(record)}</td>)}
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
