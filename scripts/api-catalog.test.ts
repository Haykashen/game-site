import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchCatalog, collectPages, fetchCatalogPage, fetchGameDetail, fetchCatalogFilters } from '../src/api/catalog.ts';
import { CatalogPager } from '../src/lib/catalogPager.ts';
import type { GameWithStatsDto, Paginated } from '@discvault/shared';

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

const game = (id: string) => ({id, title: id, publisher: '', developer: '', series: '', year: null, genres: [], description: '', coverImage: '', stats: {platforms: [], editionCount: 0, ownedCount: 0, lotsCount: 0}} satisfies GameWithStatsDto);
const page = (number: number, ids: string[], hasMore: boolean): Paginated<GameWithStatsDto> => ({items: ids.map(game), total: 5, page: number, pageSize: 24, hasMore});

test('catalogue requests exactly one page of 24 games with all server filters', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input, options) => {
    calls.push(String(input)); assert.ok(options?.signal);
    return new Response(JSON.stringify(page(2, ['filtered'], true)));
  };
  try {
    const result = await fetchCatalogPage({q: 'Игра & test', platform: 'PS5', region: 'RU', lang: 'русский', edition: 'Collector', year: '2020-2024'}, 2, new AbortController().signal);
    assert.equal(result.page, 2);
    assert.equal(calls.length, 1);
    const url = new URL(calls[0]!, 'https://test.invalid');
    assert.equal(url.pathname, '/api/v1/catalog/games');
    assert.deepEqual(Object.fromEntries(url.searchParams), {page: '2', pageSize: '24', q: 'Игра & test', platform: 'PS5', region: 'RU', lang: 'русский', edition: 'Collector', year: '2020-2024'});
  } finally {globalThis.fetch = original;}
});

test('detail and filter helpers never download the complete catalogue', async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {calls.push(String(input)); return new Response('{}');};
  try {
    const signal = new AbortController().signal;
    await fetchGameDetail('url/game', signal);
    await fetchCatalogFilters(signal);
    assert.deepEqual(calls, ['/api/v1/catalog/games/url%2Fgame', '/api/v1/catalog/filters']);
  } finally {globalThis.fetch = original;}
});

test('pager only fetches the next page on demand and ignores concurrent observer events', async () => {
  const calls: number[] = [];
  let resolveFirst!: (value: Paginated<GameWithStatsDto>) => void;
  const pager = new CatalogPager(async (number) => {
    calls.push(number);
    return number === 1 ? new Promise((resolve) => {resolveFirst = resolve;}) : page(2, ['two'], false);
  });
  const first = pager.loadNext();
  await pager.loadNext(); await pager.loadNext();
  assert.deepEqual(calls, [1]);
  resolveFirst(page(1, ['one'], true)); await first;
  assert.deepEqual(calls, [1]);
  assert.equal(pager.getSnapshot().items.length, 1);
  await pager.loadNext(); await pager.loadNext();
  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual(pager.getSnapshot().items.map((item) => item.id), ['one', 'two']);
});

test('failed next pages preserve cards and retry the same page without duplicates', async () => {
  const calls: number[] = [];
  let fail = true;
  const pager = new CatalogPager(async (number) => {
    calls.push(number);
    if (number === 1) return page(1, ['one', 'two'], true);
    if (fail) {fail = false; throw new Error('Temporary failure');}
    return page(2, ['two', 'three'], false);
  });
  await pager.loadNext(); await pager.loadNext();
  assert.equal(pager.getSnapshot().items.length, 2);
  assert.equal(pager.getSnapshot().page, 1);
  assert.equal(pager.getSnapshot().error, 'Temporary failure');
  await pager.loadNext();
  assert.deepEqual(calls, [1, 2, 2]);
  assert.deepEqual(pager.getSnapshot().items.map((item) => item.id), ['one', 'two', 'three']);
});

test('aborted search responses cannot enter the next filter or account results', async () => {
  let resolveOld!: (value: Paginated<GameWithStatsDto>) => void;
  let signal!: AbortSignal;
  const old = new CatalogPager(async (_page, requestSignal) => {signal = requestSignal; return new Promise((resolve) => {resolveOld = resolve;});});
  const pending = old.loadNext(); old.dispose();
  const fresh = new CatalogPager(async () => page(1, ['new-query'], false));
  await fresh.loadNext();
  resolveOld(page(1, ['stale-account'], true)); await pending;
  assert.equal(signal.aborted, true);
  assert.equal(old.getSnapshot().items.length, 0);
  assert.deepEqual(fresh.getSnapshot().items.map((item) => item.id), ['new-query']);
});

test('a repeated or empty page with hasMore cannot cause infinite background requests', async () => {
  const pager = new CatalogPager(async (number) => page(number, ['same'], true));
  await pager.loadNext(); await pager.loadNext();
  assert.match(pager.getSnapshot().error ?? '', /повторил страницу/);
  assert.equal(pager.getSnapshot().items.length, 1);
  assert.equal(pager.getSnapshot().loading, false);
});

test('refresh after editing cancels a pending next page and reloads the first page', async () => {
  let version = 0;
  let resolveOld!: (value: Paginated<GameWithStatsDto>) => void;
  const calls: number[] = [];
  const pager = new CatalogPager(async (number) => {
    calls.push(number);
    if (number === 2) return new Promise((resolve) => {resolveOld = resolve;});
    return page(1, [version ? 'updated-game' : 'original-game'], true);
  });
  await pager.loadNext();
  const pending = pager.loadNext();
  version = 1;
  await pager.refresh();
  resolveOld(page(2, ['obsolete-game'], false)); await pending;
  assert.deepEqual(calls, [1, 2, 1]);
  assert.equal(pager.getSnapshot().page, 1);
  assert.deepEqual(pager.getSnapshot().items.map((item) => item.id), ['updated-game']);
});
