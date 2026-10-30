import { AdminTablesPage } from './AdminTablesPage';

const REFERENCE_TABLES = ['GameGenre', 'GameSeries', 'Region'] as const;

export function AdminReferencePage() {
  return (
    <AdminTablesPage
      basePath="/admin/reference"
      defaultTable="GameGenre"
      tableNames={REFERENCE_TABLES}
      title="Справочники"
      heading={() => 'Справочники'}
      eyebrow="ADMIN / REFERENCE"
      description="Жанры, серии игр и регионы выпуска: поиск по таблице, фильтры по столбцам и управление записями."
      navLabel="Справочники игр"
    />
  );
}
