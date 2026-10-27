import { Link, Navigate, useParams } from 'react-router-dom';
import { AdminRecords } from '../components/admin/AdminRecords';
import { AdminAccessNotice } from '../components/admin/AdminAccessNotice';
import { PageHeading } from '../components/PageHeading';
import { useAuth } from '../context/AuthContext';
import { useAdminTables } from '../hooks/useAdminTables';

export function AdminDataPage() {
  const {table: name} = useParams();
  const {isAdmin, user} = useAuth();
  const schema = useAdminTables();
  const table = schema.data.find((item) => item.name === name);
  if (!isAdmin) return <><PageHeading title="Данные" eyebrow="ADMIN / DATA" description="Управление таблицами проекта." /><AdminAccessNotice /></>;
  if (schema.error) return <div className="panel admin-data__error" role="alert">{schema.error}<button className="btn-secondary" onClick={() => void schema.refresh()}>Повторить</button></div>;
  if (schema.isLoading) return <p role="status">Загружаем таблицы…</p>;
  if (!name) return <Navigate to="/admin/data/Game" replace />;
  return <>
    <PageHeading title={table?.label ?? 'Таблица не найдена'} eyebrow="ADMIN / DATA" description="Поиск по таблице, фильтры по столбцам и управление записями." />
    <nav className="admin-data__tables" aria-label="Таблицы базы данных">
      {schema.data.map((item) => <Link key={item.name} to={`/admin/data/${item.name}`} className={`btn-secondary${item.name === name ? ' is-active' : ''}`} aria-current={item.name === name ? 'page' : undefined}>{item.label}</Link>)}
    </nav>
    {table && <AdminRecords key={`${user?.id}:${name}`} table={table} />}
  </>;
}
