import { AdminTablesPage } from './AdminTablesPage';

export function AdminDataPage() {
  return (
    <AdminTablesPage
      basePath="/admin/data"
      defaultTable="Game"
      excludeTableNames={['GameGenre', 'GameSeries', 'Region']}
      title="Данные"
      heading={(table) => table?.label ?? 'Таблица не найдена'}
      eyebrow="ADMIN / DATA"
      description="Поиск по таблице, фильтры по столбцам и управление записями."
      navLabel="Таблицы базы данных"
    />
  );
}
