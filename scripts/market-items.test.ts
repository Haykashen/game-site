import assert from 'node:assert/strict';
import test from 'node:test';
import { marketCreateSchema, marketUpdateSchema } from '../shared/src/market.ts';
import { MARKET_ITEM_OPTIONS } from '../shared/src/marketItems.ts';
import { INITIAL_EDITIONS, INITIAL_GAMES, INITIAL_MARKET_ENTRIES } from '../src/data/index.ts';
import { parseMarketEntries } from '../src/lib/storage.ts';
import { selectVisibleMarketEntries } from '../src/lib/selectVisibleMarketEntries.ts';

const base = {
  kind: 'listing', listingType: 'sale', gameId: 'elden-ring', editionId: null,
  title: 'Фигурка Elden Ring', condition: 'Оригинал', price: 1000,
  description: 'Только фигурка, без игры.', photos: [], deliveryServices: ['cdek'], shipsFrom: 'Москва',
};

test('all loot categories support sales, purchases, exchange and auctions without an edition', () => {
  for (const { value: itemType } of MARKET_ITEM_OPTIONS.filter((option) => option.value !== 'game')) {
    for (const listingType of ['sale', 'purchase', 'exchange']) {
      assert.equal(marketCreateSchema.safeParse({ ...base, itemType, listingType }).success, true);
    }
    assert.equal(marketCreateSchema.safeParse({ ...base, itemType, kind: 'auction', listingType: null,
      bidStep: 100, startsAt: '2030-01-01T12:00:00.000Z', endsAt: '2030-01-02T12:00:00.000Z' }).success, true);
  }
});

test('game edition requirements and auction validation remain intact', () => {
  assert.equal(marketCreateSchema.safeParse(base).success, false);
  assert.equal(marketCreateSchema.safeParse({ ...base, listingType: 'purchase' }).success, true);
  assert.equal(marketCreateSchema.safeParse({ ...base, editionId: INITIAL_EDITIONS[0]!.id }).success, true);
  assert.equal(marketCreateSchema.safeParse({ ...base, itemType: 'invalid' }).success, false);
  assert.equal(marketCreateSchema.safeParse({ ...base, itemType: 'figure', kind: 'auction', listingType: null }).success, false);
  assert.equal(marketUpdateSchema.parse({ title: 'Новое название' }).itemType, undefined);
});

test('local saves preserve loot without silently binding an edition, and migrate legacy games', () => {
  const loot = { ...INITIAL_MARKET_ENTRIES[0]!, itemType: 'figure', editionId: null };
  const parsed = parseMarketEntries(JSON.parse(JSON.stringify([loot])), INITIAL_EDITIONS)!;
  assert.equal(parsed[0]!.itemType, 'figure');
  assert.equal(parsed[0]!.editionId, null);
  const { itemType: _legacyType, ...legacy } = INITIAL_MARKET_ENTRIES[0]!;
  assert.equal(parseMarketEntries([legacy], INITIAL_EDITIONS)![0]!.itemType, 'game');
  assert.deepEqual(parseMarketEntries([{ ...loot, itemType: 'invalid' }], INITIAL_EDITIONS), []);
});

test('category and text filters find loot without inventing a platform for unbound items', () => {
  const loot = { ...INITIAL_MARKET_ENTRIES[0]!, id: 'loot-test', itemType: 'figure' as const, editionId: null };
  const entries = [...INITIAL_MARKET_ENTRIES, loot];
  const games = new Map(INITIAL_GAMES.map((game) => [game.id, game]));
  const editions = new Map(INITIAL_EDITIONS.map((edition) => [edition.id, edition]));
  const filters = { query: '', itemType: '', platform: '', lang: '', yearRange: '', region: '', edition: '', completeness: '' };
  const select = (extra: Partial<typeof filters>) => selectVisibleMarketEntries(entries, games, editions, INITIAL_EDITIONS, { ...filters, ...extra });
  assert.deepEqual(select({ itemType: 'figure' }).map((entry) => entry.id), ['loot-test']);
  assert.deepEqual(select({ query: 'фигурка' }).map((entry) => entry.id), ['loot-test']);
  assert.deepEqual(select({ itemType: 'figure', platform: 'PS2' }), []);
  assert.equal(select({ itemType: 'game' }).length, INITIAL_MARKET_ENTRIES.length);
});
