import { AdminTablesPage } from './AdminTablesPage';

const REFERENCE_TABLES = ['GameGenre', 'GameSeries'] as const;

export function AdminReferencePage() {
  return (
    <AdminTablesPage
      basePath="/admin/reference"
      defaultTable="GameGenre"
      tableNames={REFERENCE_TABLES}
      title="Справочники"
      heading={() => 'Справочники'}
      eyebrow="ADMIN / REFERENCE"
      description="Жанры и серии игр: поиск по таблице, фильтры по столбцам и управление записями."
      navLabel="Справочники игр"
    />
  );
}
