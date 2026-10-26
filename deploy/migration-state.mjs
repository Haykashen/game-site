/** Compare the release's immutable migration files with Prisma's database journal. */
export function migrationState(files, rows) {
  const completed = new Set();
  for (const row of rows) {
    if (row.rolled_back_at) continue;
    if (!row.finished_at) throw new Error(`Unfinished migration: ${row.migration_name}`);
    const checksum = files.get(row.migration_name);
    if (!checksum) throw new Error(`Release is missing applied migration: ${row.migration_name}`);
    if (checksum !== row.checksum) throw new Error(`Applied migration was modified: ${row.migration_name}`);
    completed.add(row.migration_name);
  }
  const pending = [...files.keys()].filter((name) => !completed.has(name)).sort();
  const lastApplied = [...completed].sort().at(-1);
  if (lastApplied && pending.some((name) => name < lastApplied)) {
    throw new Error('A pending migration precedes an already applied migration. Review migration history.');
  }
  return pending;
}
