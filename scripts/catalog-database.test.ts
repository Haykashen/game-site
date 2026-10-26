import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const isTestDatabase = process.env.CI === 'true' && (process.env.DATABASE_URL ?? '').includes('/discvault_ci');
test('public catalogue and filter endpoints expose rows created in PostgreSQL, without seed', {
  skip: !isTestDatabase ? 'Runs only against the isolated CI database discvault_ci.' : false,
}, async () => {
  const uploads = await mkdtemp(join(tmpdir(), 'discvault-api-test-'));
  process.env.UPLOAD_DIR = uploads;
  process.env.S3_ENDPOINT = '';
  process.env.S3_BUCKET = '';
  const { buildApp } = await import('../server/src/app.ts');
  const app = await buildApp();
  const id = 'ci-catalog-' + randomUUID();
  try {
    await app.prisma.game.create({ data: {
      id, title: 'PostgreSQL catalogue fixture', publisher: 'Test', year: 2026,
      genres: ['Test'], description: 'Database-only fixture, never deployed to production.',
      editions: { create: { id: id + '-edition', name: 'Database edition', platform: 'CI Platform',
        region: 'CI Region', lang: 'CI Language', media: 'Disc', contents: [], coverImages: [] } },
    } });
    const games = await app.inject({ method: 'GET', url: '/api/v1/catalog/games?q=' + encodeURIComponent('PostgreSQL catalogue fixture') });
    assert.equal(games.statusCode, 200);
    assert.equal(games.json().items[0].id, id);
    const editions = await app.inject({ method: 'GET', url: '/api/v1/catalog/editions?gameId=' + id });
    assert.equal(editions.statusCode, 200);
    assert.equal(editions.json().items[0].platform, 'CI Platform');
    const filters = await app.inject({ method: 'GET', url: '/api/v1/catalog/filters' });
    assert.equal(filters.statusCode, 200);
    assert.ok(filters.json().platforms.some((platform: { name: string }) => platform.name === 'CI Platform'));
    assert.ok(filters.json().editions.includes('Database edition'));
  } finally {
    await app.prisma.game.deleteMany({ where: { id } });
    await app.close();
    await rm(uploads, { recursive: true, force: true });
  }
});
