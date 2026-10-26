import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchCatalog, collectPages } from '../src/api/catalog.ts';

test('catalogue reads all API pages and includes database-only games and editions', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    calls.push(url);
    assert.ok(options?.signal);
    const page = Number(new URL(url, 'https://test.invalid').searchParams.get('page'));
    const isGames = url.includes('/games?');
    const items = isGames
      ? page === 1 ? Array.from({ length: 100 }, (_, i) => ({ id: 'database-' + i })) : [{ id: 'database-only-new-game' }]
      : [{ id: 'database-only-edition', gameId: 'database-only-new-game', platform: 'New database platform' }];
    return new Response(JSON.stringify({ items, page, pageSize: 100, total: isGames ? 101 : 1, hasMore: isGames && page === 1 }));
  };
  try {
    const catalog = await fetchCatalog();
    assert.equal(catalog.games.length, 101);
    assert.equal(catalog.games.at(-1)?.id, 'database-only-new-game');
    assert.equal(catalog.editions[0]?.platform, 'New database platform');
    assert.equal(calls.length, 3);
  } finally { globalThis.fetch = original; }
});

test('empty database stays empty instead of restoring bundled demo games', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 100, hasMore: false }));
  try { assert.deepEqual(await fetchCatalog(), { games: [], editions: [] }); }
  finally { globalThis.fetch = original; }
});

test('API failure is an error, not a fallback to demo records', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE', message: 'База недоступна' } }), { status: 503 });
  try { await assert.rejects(fetchCatalog(), /База недоступна/); }
  finally { globalThis.fetch = original; }
});

test('broken pagination fails instead of looping forever', async () => {
  await assert.rejects(collectPages(async () => ({ items: [], total: 1, page: 1, pageSize: 100, hasMore: true })), /некорректную страницу/);
});
