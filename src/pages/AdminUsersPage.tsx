import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AdminUserDto, AdminUserSortField, Paginated, UserRole, UserStatus } from '@discvault/shared';
import { listAdminUsers } from '../api';
import { PageHeading } from '../components/PageHeading';
import { AdminAccessNotice } from '../components/admin/AdminAccessNotice';
import { AdminDataTable, type AdminColumn } from '../components/admin/AdminDataTable';
import { AdminRecordDialog, type AdminEditor } from '../components/admin/AdminRecordDialog';
import { AdminRecords } from '../components/admin/AdminRecords';
import { useAuth } from '../context/AuthContext';
import { useAdminTables } from '../hooks/useAdminTables';
import { useApiResource } from '../hooks/useApiResource';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

interface ColumnFilters {
  id: string;
  online: 'all' | 'online' | 'offline'; lastSeenAt: string;
  search: string; role: 'all' | UserRole; status: 'all' | UserStatus;
  comment: string; listings: string; deals: string; copies: string; rating: string; createdAt: string;
}
const INITIAL: ColumnFilters = {id: '', online: 'all', lastSeenAt: '', search: '', role: 'all', status: 'all', comment: '', listings: '', deals: '', copies: '', rating: '', createdAt: ''};
const PAGE_SIZE = 10;
const EMPTY: Paginated<AdminUserDto> = {items: [], total: 0, page: 1, pageSize: 20, hasMore: false};
const ROLES: Record<UserRole, string> = {admin: 'Администратор', moderator: 'Модератор', user: 'Пользователь'};
const STATUSES: Record<UserStatus, string> = {active: 'Активен', suspended: 'Заблокирован', deleted: 'Удалён'};
const count = (value: number) => value.toLocaleString('ru-RU');
function optionalNumber(value: string, maximum = Number.MAX_SAFE_INTEGER): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= maximum ? parsed : undefined;
}
function UserIdentity({user}: {user: AdminUserDto}) {
  return <div className="admin-users__identity">
    {user.avatarUrl ? <img className="admin-users__avatar" src={user.avatarUrl} alt="" /> : <span className="admin-users__avatar admin-users__avatar--empty">{user.displayName.slice(0, 1).toUpperCase()}</span>}
    <span className="admin-users__identity-copy"><span className="admin-users__name">{user.displayName}</span>
      <small>{user.email}</small>{user.isDemo && <small className="admin-users__demo">демо-аккаунт</small>}
    </span>
  </div>;
}

export function AdminUsersPage() {
  const {isAdmin, user} = useAuth();
  return <>
    {!isAdmin ? <><PageHeading eyebrow="ADMIN / USERS" title="Пользователи" description="Управление аккаунтами пользователей." /><AdminAccessNotice /></> : <UsersTable key={user?.id} />}
  </>;
}

function UsersTable() {
  const {user, refresh: refreshAuth} = useAuth();
  const schema = useAdminTables();
  const table = schema.data.find((item) => item.name === 'User');
  const [drafts, setDrafts] = useState<ColumnFilters>(INITIAL);
  const debounced = useDebouncedValue(drafts);
  const [filters, setFilters] = useState(INITIAL);
  const [sortBy, setSortBy] = useState<AdminUserSortField>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<AdminEditor | null>(null);
  const [notice, setNotice] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [relatedTableName, setRelatedTableName] = useState('Copy');
  const relatedTables = schema.data.filter((item) => item.fields.some((field) => field.reference === 'User'));
  const relatedTable = relatedTables.find((item) => item.name === relatedTableName) ?? relatedTables[0];
  useEffect(() => {setFilters(debounced); setPage(1);}, [debounced]);
  const load = useCallback((signal: AbortSignal) => listAdminUsers({
    id: filters.id.trim() || undefined,
    online: filters.online, lastSeenAt: filters.lastSeenAt || undefined,
    search: filters.search.trim() || undefined, role: filters.role, status: filters.status,
    comment: filters.comment.trim() || undefined, listings: optionalNumber(filters.listings),
    deals: optionalNumber(filters.deals), copies: optionalNumber(filters.copies), rating: optionalNumber(filters.rating, 5),
    createdAt: filters.createdAt || undefined, sortBy, sortDir, page, pageSize: PAGE_SIZE,
  }, signal), [filters, sortBy, sortDir, page]);
  const result = useApiResource('admin-users:' + user?.id, load, EMPTY);
  const selectedUser = result.data.items.find((item) => item.id === selectedId);
  useEffect(() => {setSelectedId('');}, [filters, page, sortBy, sortDir]);
  useEffect(() => {
    const timer = window.setInterval(() => {if (document.visibilityState === 'visible') void result.refresh();}, 30_000);
    return () => window.clearInterval(timer);
  }, [result.refresh]);
  useEffect(() => {
    if (!result.isLoading && !result.error && page > 1 && !result.data.items.length) setPage(Math.max(1, Math.ceil(result.data.total / PAGE_SIZE)));
  }, [result.isLoading, result.error, result.data, page]);
  function filter<K extends keyof ColumnFilters>(key: K, value: ColumnFilters[K]) {setDrafts((previous) => ({...previous, [key]: value}));}
  const input = (key: keyof ColumnFilters, label: string, type = 'search', placeholder = '') => <input className="form-control admin-users__column-input" type={type} aria-label={label} placeholder={placeholder} min={type === 'number' ? 0 : undefined} max={key === 'rating' ? 5 : undefined} step={key === 'rating' ? 0.1 : type === 'number' ? 1 : undefined} value={drafts[key]} maxLength={key === 'comment' ? 2000 : 120} onChange={(event) => filter(key, event.target.value)} />;
  const columns: AdminColumn<AdminUserDto, AdminUserSortField>[] = [
    {key: 'id', label: 'ID', render: (item) => <span className="admin-data__cell admin-users__id" title={item.id}>{item.id}</span>, filter: input('id', 'Фильтр по ID пользователя', 'search', 'ID пользователя')},
    {key: 'user', label: 'Пользователь', render: (item) => <UserIdentity user={item} />, filter: input('search', 'Поиск по имени или почте', 'search', 'Имя или почта')},
    {key: 'isOnline', label: 'В сети', render: (item) => <span className={`admin-users__presence${item.isOnline ? ' is-online' : ''}`}><span aria-hidden="true" />{item.isOnline ? 'В сети' : 'Не в сети'}</span>, filter: <select className="form-control admin-users__column-input" aria-label="Фильтр по присутствию" value={drafts.online} onChange={(event) => filter('online', event.target.value as ColumnFilters['online'])}><option value="all">Все</option><option value="online">В сети</option><option value="offline">Не в сети</option></select>},
    {key: 'lastSeenAt', label: 'Последнее посещение', render: (item) => item.lastSeenAt ? <time dateTime={item.lastSeenAt}>{new Date(item.lastSeenAt).toLocaleString('ru-RU')}</time> : 'Нет данных', filter: input('lastSeenAt', 'Фильтр по последнему посещению (UTC)', 'date')},
    {key: 'role', label: 'Роль', render: (item) => <span className={`admin-users__role admin-users__role--${item.role}`}>{ROLES[item.role]}</span>, filter: <select className="form-control admin-users__column-input" aria-label="Фильтр по роли" value={drafts.role} onChange={(event) => filter('role', event.target.value as ColumnFilters['role'])}><option value="all">Все</option>{Object.entries(ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>},
    {key: 'status', label: 'Статус', render: (item) => <span className={`admin-users__status admin-users__status--${item.status}`}>{STATUSES[item.status]}</span>, filter: <select className="form-control admin-users__column-input" aria-label="Фильтр по статусу" value={drafts.status} onChange={(event) => filter('status', event.target.value as ColumnFilters['status'])}><option value="all">Все</option>{Object.entries(STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>},
    {key: 'comment', label: 'Комментарий', render: (item) => <span className="admin-users__comment" title={item.comment ?? ''}>{item.comment || '—'}</span>, filter: input('comment', 'Поиск по комментарию', 'search', 'Текст комментария')},
    {key: 'listings', label: 'Лоты', render: (item) => <strong>{count(item.listings)}</strong>, filter: input('listings', 'Фильтр по количеству лотов', 'number', '0')},
    {key: 'deals', label: 'Сделки', render: (item) => <strong>{count(item.deals)}</strong>, filter: input('deals', 'Фильтр по количеству сделок', 'number', '0')},
    {key: 'copies', label: 'Коллекция', render: (item) => <strong>{count(item.copies)}</strong>, filter: input('copies', 'Фильтр по количеству экземпляров', 'number', '0')},
    {key: 'rating', label: 'Рейтинг', render: (item) => <>{item.rating === null ? '—' : <strong>{item.rating.toFixed(1)}</strong>}<small>{item.reviewCount ? `Отзывов: ${count(item.reviewCount)}` : 'нет отзывов'}</small></>, filter: input('rating', 'Фильтр по рейтингу', 'number', '4.5')},
    {key: 'createdAt', label: 'Регистрация', render: (item) => new Date(item.createdAt).toLocaleDateString('ru-RU'), filter: input('createdAt', 'Фильтр по дате регистрации', 'date')},
  ];
  return <>
    <PageHeading eyebrow="ADMIN / USERS" title="Пользователи" description="Выберите строку пользователя, чтобы посмотреть связанные данные ниже. Поиск, фильтры и сортировка доступны по столбцам."
      action={<div className="admin-data__row-actions"><Link className="btn-secondary" to="/admin/data">Все таблицы</Link><button className="btn-secondary" disabled={result.isLoading} onClick={() => void result.refresh()}><RefreshCw size={15} />Обновить</button><button className="btn-primary" disabled={!table} onClick={() => setEditor({mode: 'create', key: null})}><Plus size={15} />Добавить пользователя</button></div>} />
    {notice && <p role="status" className="admin-data__help">{notice}</p>}
    {(schema.error || result.error) && <div className="admin-data__error" role="alert">{schema.error || result.error}<button className="btn-secondary" onClick={() => {void schema.refresh(); void result.refresh();}}>Повторить</button></div>}
    <p className="admin-data__help">«В сети» — активная сессия с обращением к сайту за последние 2 минуты. Обновляется каждые 30 секунд.</p>
    <AdminDataTable label="Пользователи" compact onSelect={(item) => setSelectedId(item.id)} selectedKey={selectedId} columns={columns} rows={result.error ? [] : result.data.items} rowKey={(item) => item.id} sortBy={sortBy} sortDir={sortDir} onSort={(key) => {setPage(1); setSortBy(key); setSortDir(key === sortBy ? sortDir === 'asc' ? 'desc' : 'asc' : key === 'createdAt' ? 'desc' : 'asc');}} loading={result.isLoading} total={result.data.total} page={page} pageSize={PAGE_SIZE} onPage={setPage} onReset={() => {setDrafts(INITIAL); setFilters(INITIAL); setPage(1);}} hasFilters={JSON.stringify(drafts) !== JSON.stringify(INITIAL)} actions={(item) => <>
      <button type="button" className="btn-secondary" disabled={!table} aria-label={`Редактировать: ${item.displayName}`} onClick={() => setEditor({mode: 'edit', key: JSON.stringify({id: item.id})})}><Pencil size={15} /></button>
      <button type="button" className="btn-secondary admin-data__danger" disabled={!table || item.id === user?.id} aria-label={`Удалить: ${item.displayName}`} title={item.id === user?.id ? 'Нельзя удалить собственный аккаунт' : 'Удалить пользователя'} onClick={() => setEditor({mode: 'delete', key: JSON.stringify({id: item.id})})}><Trash2 size={15} /></button>
    </>} />
    <section className="admin-users__related" aria-labelledby="user-related-title">
      <h2 id="user-related-title">Связанные данные</h2>
      <p className="admin-data__help">{selectedUser ? `${selectedUser.displayName} · ${selectedUser.id}` : 'Выберите пользователя в верхней таблице.'}</p>
      <div className="admin-data__tables" role="group" aria-label="Таблицы, связанные с пользователем">
        {relatedTables.map((item) => <button type="button" key={item.name} className={`btn-secondary${relatedTable?.name === item.name ? ' is-active' : ''}`} aria-pressed={relatedTable?.name === item.name} onClick={() => setRelatedTableName(item.name)}>{item.label}</button>)}
      </div>
      {selectedUser && relatedTable ? <>
        <h3>{relatedTable.label}</h3>
        <p className="admin-data__help">Все записи, где выбранный пользователь указан в полях: {relatedTable.fields.filter((field) => field.reference === 'User').map((field) => field.label).join(', ')}.</p>
        <AdminRecords key={`${selectedUser.id}:${relatedTable.name}`} table={relatedTable} relatedUserId={selectedUser.id} />
      </> : <div className="panel admin-users__related-empty">Нажмите на строку пользователя и выберите таблицу для просмотра его записей.</div>}
    </section>
    {editor && table && <AdminRecordDialog key={`${editor.mode}:${editor.key}`} table={table} editor={editor} onClose={() => setEditor(null)} onSaved={async () => {setNotice('Изменения сохранены.'); if (editor.key === JSON.stringify({id: user?.id})) await refreshAuth(); await result.refresh();}} />}
  </>;
}
