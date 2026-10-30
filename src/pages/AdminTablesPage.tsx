import type { AdminTable } from '@discvault/shared';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AdminAccessNotice } from '../components/admin/AdminAccessNotice';
import { AdminRecords } from '../components/admin/AdminRecords';
import { PageHeading } from '../components/PageHeading';
import { useAuth } from '../context/AuthContext';
import { useAdminTables } from '../hooks/useAdminTables';

export interface AdminTablesPageProps {
  readonly basePath: string;
  readonly defaultTable: string;
  readonly tableNames?: readonly string[];
  readonly excludeTableNames?: readonly string[];
  readonly title: string;
  readonly heading: (table: AdminTable | undefined) => string;
  readonly eyebrow: string;
  readonly description: string;
  readonly navLabel: string;
}

/** Shared table browser used by the full database page and scoped reference pages. */
export function AdminTablesPage({
  basePath,
  defaultTable,
  tableNames,
  excludeTableNames,
  title,
  heading,
  eyebrow,
  description,
  navLabel,
}: AdminTablesPageProps) {
  const { table: name } = useParams();
  const { isAdmin, user } = useAuth();
  const schema = useAdminTables();
  const tables = tableNames
    ? schema.data.filter((item) => tableNames.includes(item.name))
    : schema.data.filter(item => !excludeTableNames?.includes(item.name));
  const table = tables.find((item) => item.name === name);

  if (!isAdmin) {
    return (
      <>
        <PageHeading title={title} eyebrow={eyebrow} description={description} />
        <AdminAccessNotice />
      </>
    );
  }

  if (schema.error) {
    return (
      <div className="panel admin-data__error" role="alert">
        {schema.error}
        <button className="btn-secondary" onClick={() => void schema.refresh()}>Повторить</button>
      </div>
    );
  }

  if (schema.isLoading) return <p role="status">Загружаем таблицы…</p>;

  if (!tables.length) {
    return (
      <>
        <PageHeading title={title} eyebrow={eyebrow} description={description} />
        <div className="panel admin-data__error" role="alert">Таблицы не найдены.</div>
      </>
    );
  }

  if (name && excludeTableNames?.includes(name)) return <Navigate to={'/admin/reference/' + name} replace />;
  if (!name) {
    return <Navigate to={`${basePath}/${defaultTable}`} replace />;
  }

  return (
    <>
      <PageHeading title={heading(table)} eyebrow={eyebrow} description={description} />
      <nav className="admin-data__tables" aria-label={navLabel}>
        {tables.map((item) => (
          <Link
            key={item.name}
            to={`${basePath}/${item.name}`}
            className={`btn-secondary${item.name === name ? ' is-active' : ''}`}
            aria-current={item.name === name ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {table && <AdminRecords key={`${user?.id}:${name}`} table={table} />}
    </>
  );
}
