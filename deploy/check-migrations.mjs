import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { migrationState } from './migration-state.mjs';

const require = createRequire('/app/server/package.json');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
try {
  const directory = '/app/server/prisma/migrations';
  const files = new Map();
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sql = await readFile(`${directory}/${entry.name}/migration.sql`);
    files.set(entry.name, createHash('sha256').update(sql).digest('hex'));
  }
  const rows = await prisma.$queryRawUnsafe(
    'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"',
  );
  const pending = migrationState(files, rows);
  console.log(pending.length ? `Pending migrations: ${pending.join(', ')}` : 'Migration history matches the release.');
  process.exitCode = pending.length ? 2 : 0;
} catch (error) {
  // Do not print connection strings or arbitrary database error details.
  console.error('Cannot verify migration history. Check DB connectivity and Prisma migration journal.');
  if (error instanceof Error && /^(Unfinished migration|Release is missing|Applied migration|A pending migration)/.test(error.message)) {
    console.error(error.message);
  }
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
