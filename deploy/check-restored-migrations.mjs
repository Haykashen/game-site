import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const database = process.env.STATUS_PREFLIGHT_DB;
if (!/^discvault_check_[a-f0-9]{12}_[0-9]+$/.test(database ?? '')) throw Error('Invalid preflight database');
const url = new URL(process.env.DATABASE_URL);
if (url.pathname.slice(1) === database) throw Error('Preflight must use a separate database');
url.pathname = '/' + database;
const require = createRequire('/app/server/package.json');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({datasources: {db: {url: url.toString()}}});
const tables = ['games','editions','market_entries','news_posts','discussions','users','deals','reports'];
async function snapshot() {
  const result = [];
  for (const table of tables) {
    // Editions inherit moderation from games; these reviewed columns are removed.
    // Verify every remaining edition value, not merely the row count.
    if (table === 'editions') {
      result.push(await prisma.$queryRawUnsafe(`SELECT count(*)::text AS count, md5(coalesce(string_agg((to_jsonb(e) - ARRAY['status_id','moderation_note','moderated_at','moderator_id','lang'])::text, ',' ORDER BY id), '')) AS fingerprint FROM editions e`));
      continue;
    }
    result.push(await prisma.$queryRawUnsafe(
    'SELECT count(*)::text AS count, md5(coalesce(string_agg(id::text || ' + "':'" + ' || status_id::text, ' + "','" + ' ORDER BY id), ' + "''" + ')) AS fingerprint FROM ' + table));
  }
  return result;
}
try {
  const before = await snapshot();
  const migration = spawnSync(process.execPath, ['/app/node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    {env: {...process.env, DATABASE_URL: url.toString()}, stdio: 'inherit', timeout: 300000});
  if (migration.error || migration.status !== 0) throw Error('Restored database migration failed');
  assert.deepEqual(await snapshot(), before, 'Migration changed records or their status references');
  const legacy = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name IN ('games','editions','market_entries','news_posts','discussions','users','deals','reports') AND column_name IN ('status','moderation_status')");
  assert.equal(legacy.length, 0, 'Compatibility status columns remain');
  console.log('Restored backup migrated successfully; all record/status fingerprints are unchanged outside reviewed removed edition fields.');
} catch {
  console.error('Restored backup migration verification failed. Live schema was not changed.');
  process.exitCode = 1;
} finally {await prisma.$disconnect();}
