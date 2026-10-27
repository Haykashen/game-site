import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { adminOptionLabel, adminRecordKey, type AdminField, type AdminRecord, type Paginated } from '@discvault/shared';
import { fetchAdminRecords } from '../api/adminData';
import { AdminDataTable, type AdminColumn } from '../components/admin/AdminDataTable';
import { AdminRecordDialog, type AdminEditor } from '../components/admin/AdminRecordDialog';
import { AdminAccessNotice } from '../components/admin/AdminAccessNotice';
import { PageHeading } from '../components/PageHeading';
import { useAuth } from '../context/AuthContext';
import { useAdminTables } from '../hooks/useAdminTables';
import { useApiResource } from '../hooks/useApiResource';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const EMPTY: Paginated<AdminRecord> = {items: [], total: 0, page: 1, pageSize: 20, hasMore: false};
const fieldValue = (value: AdminRecord[string] | undefined) => value === null || value === undefined ? '—' : Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? value ? 'Да' : 'Нет' : String(value);

export function AdminDataPage() {
  const {table: name} = useParams();
  const {isAdmin, user} = useAuth();
  const schema = useAdminTables();
  const table = schema.data.find((item) => item.name === name);
  if (!isAdmin) return <><PageHeading title="Данные" eyebrow="ADMIN / DATA" description="Управление таблицами проекта." /><AdminAccessNotice /></>;
  if (schema.error) return <div className="panel admin-data__error" role="alert">{schema.error}<button className="btn-secondary" onClick={() => void schema.refresh()}>Повторить</button></div>;
  if (schema.isLoading) return <p role="status">Загружаем таблицы…</p>;
  if (!name) return <Navigate to="/admin/data/Game" replace />;
  if (name === 'User') return <Navigate to="/admin/users" replace />;
  return <>
    <PageHeading title={table?.label ?? 'Таблица не найдена'} eyebrow="ADMIN / DATA" description="Поиск по таблице, фильтры по столбцам и управление записями." />
    <nav className="admin-data__tables" aria-label="Таблицы базы данных">
      {schema.data.map((item) => <Link key={item.name} to={item.name === 'User' ? '/admin/users' : `/admin/data/${item.name}`} className={`btn-secondary${item.name === name ? ' is-active' : ''}`} aria-current={item.name === name ? 'page' : undefined}>{item.label}</Link>)}
    </nav>
    {table && <Records key={`${user?.id}:${name}`} table={table} />}
  </>;
}

function ColumnFilter({field, value, onChange}: {field: AdminField; value: string; onChange: (value: string) => void}) {
  if (field.type === 'boolean' || field.type === 'enum' || field.options.length) return <select className="form-control admin-users__column-input" aria-label={`Фильтр: ${field.label}`} value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">Все</option>{(field.type === 'boolean' ? ['true', 'false'] : field.options).map((option) => <option key={option} value={option}>{adminOptionLabel(option)}</option>)}
  </select>;
  return <input className="form-control admin-users__column-input" aria-label={`Фильтр: ${field.label}`} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'search'} step={field.type === 'number' ? 1 : undefined} value={value} placeholder={field.reference ? 'ID записи' : 'Фильтр…'} onChange={(event) => onChange(event.target.value)} />;
}

function Records({table}: {table: import('@discvault/shared').AdminTable}) {
  const {user} = useAuth();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState(table.fields.some((field) => field.name === 'createdAt') ? 'createdAt' : table.primaryKey[0]!);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<AdminEditor | null>(null);
  const [notice, setNotice] = useState('');
  const queryDraft = useMemo(() => ({search, filters}), [search, filters]);
  const debounced = useDebouncedValue(queryDraft);
  const [applied, setApplied] = useState(debounced);
  useEffect(() => {setApplied(debounced); setPage(1);}, [debounced]);
  const load = useCallback((signal: AbortSignal) => fetchAdminRecords(table.name, {...applied, sortBy, sortDir, page, pageSize: 20}, signal), [table.name, applied, sortBy, sortDir, page]);
  const result = useApiResource(`admin:${user?.id}:${table.name}`, load, EMPTY);
  useEffect(() => {
    if (!result.isLoading && !result.error && page > 1 && !result.data.items.length) setPage(Math.max(1, Math.ceil(result.data.total / 20)));
  }, [result.isLoading, result.error, result.data, page]);
  const columns: AdminColumn<AdminRecord>[] = table.fields.filter((field) => field.type !== 'password').map((field) => ({
    key: field.name, label: field.label, sortable: field.type !== 'list',
    render: (record) => <span className="admin-data__cell" title={fieldValue(record[field.name])}>{field.type === 'date' && record[field.name] ? field.dateOnly ? new Date(String(record[field.name])).toLocaleDateString('ru-RU', {timeZone: 'UTC'}) : new Date(String(record[field.name])).toLocaleString('ru-RU') : field.type === 'enum' && record[field.name] ? adminOptionLabel(String(record[field.name])) : fieldValue(record[field.name])}</span>,
    filter: <ColumnFilter field={field} value={filters[field.name] ?? ''} onChange={(value) => setFilters((previous) => ({...previous, [field.name]: value}))} />,
  }));
  async function saved() {setNotice('Изменения сохранены.'); await result.refresh();}
  return <>
    <div className="admin-data__toolbar">
      <input type="search" className="form-control" aria-label="Поиск по таблице" placeholder="Поиск по таблице…" value={search} maxLength={200} onChange={(event) => setSearch(event.target.value)} />
      <button className="btn-secondary" type="button" disabled={result.isLoading} onClick={() => void result.refresh()}><RefreshCw size={15} />Обновить</button>
      {table.canCreate && <button className="btn-primary" type="button" onClick={() => setEditor({mode: 'create', key: null})}><Plus size={15} />Добавить запись</button>}
    </div>
    {table.name === 'Session' && <p className="admin-data__help">Сессии создаются при входе. Здесь можно проверить активность и отозвать доступ.</p>}
    {notice && <p role="status" className="admin-data__help">{notice}</p>}
    {result.error && <div className="admin-data__error" role="alert">{result.error}<button className="btn-secondary" type="button" onClick={() => void result.refresh()}>Повторить</button></div>}
    <AdminDataTable label={table.label} columns={columns} rows={result.error ? [] : result.data.items} rowKey={(record) => adminRecordKey(table, record)} sortBy={sortBy} sortDir={sortDir} onSort={(key) => {setSortBy(key); setSortDir(key === sortBy && sortDir === 'asc' ? 'desc' : 'asc'); setPage(1);}} loading={result.isLoading} total={result.data.total} page={page} pageSize={20} onPage={setPage} hasFilters={Boolean(search || Object.values(filters).some(Boolean))} onReset={() => {setSearch(''); setFilters({}); setPage(1);}} actions={(record) => <>
      {table.canEdit && <button type="button" className="btn-secondary" aria-label="Редактировать запись" onClick={() => setEditor({mode: 'edit', key: adminRecordKey(table, record)})}><Pencil size={15} /></button>}
      {table.canDelete && <button type="button" className="btn-secondary admin-data__danger" aria-label={table.name === 'Session' ? 'Отозвать сессию' : 'Удалить запись'} onClick={() => setEditor({mode: 'delete', key: adminRecordKey(table, record)})}><Trash2 size={15} /></button>}
    </>} />
    {editor && <AdminRecordDialog key={`${editor.mode}:${editor.key}`} table={table} editor={editor} onClose={() => setEditor(null)} onSaved={saved} />}
  </>;
}
