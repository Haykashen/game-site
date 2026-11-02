import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {MarketCard} from '../src/components/market/MarketCard.tsx';
import { marketCreateSchema, marketUpdateSchema } from '../shared/src/market.ts';
import { MARKET_ITEM_OPTIONS } from '../shared/src/marketItems.ts';
import { INITIAL_EDITIONS, INITIAL_GAMES, INITIAL_MARKET_ENTRIES } from '../src/data/index.ts';
import { parseMarketEntries } from '../src/lib/storage.ts';
import { selectVisibleMarketEntries } from '../src/lib/selectVisibleMarketEntries.ts';

const base = {
  kind: 'listing', listingType: 'sale', gameId: 'elden-ring', editionId: null,
  title: 'Фигурка Elden Ring', condition: 'Оригинал', price: 1000,
  description: 'Только фигурка, без игры.', photos: ['https://example.com/seller-photo.jpg'], deliveryServices: ['cdek'], shipsFrom: 'Москва',
};

test('publication requires seller photos; a private draft can be saved without them', () => {
  for (const listingType of ['sale','purchase','exchange']) {
    const data = {...base,itemType:'figure',listingType,photos:[]};
    assert.equal(marketCreateSchema.safeParse(data).success,false);
    assert.equal(marketCreateSchema.safeParse({...data,submissionStatus:'draft'}).success,true);
  }
  const auction = {...base,itemType:'figure',kind:'auction',listingType:null,bidStep:100,endsAt:'2099-01-01T00:00:00.000Z',photos:[]};
  assert.equal(marketCreateSchema.safeParse(auction).success,false);
  assert.equal(marketCreateSchema.safeParse({...auction,photos:base.photos}).success,true);
});

test('market tile never substitutes catalogue artwork for seller photographs', () => {
  const game = {...INITIAL_GAMES[0]!,coverImage:'https://example.com/game-art.jpg'};
  const edition = {...INITIAL_EDITIONS[0]!,coverImages:['https://example.com/edition-art.jpg']};
  const render = (photos:string[]) => renderToStaticMarkup(createElement(MemoryRouter,null,createElement(MarketCard,{entry:{...INITIAL_MARKET_ENTRIES[0]!,photos},game,edition,onSelect:()=>{}})));
  const empty=render([]);
  assert.match(empty,/Фотографии не добавлены/);
  assert.ok(!empty.includes('game-art.jpg'));
  assert.ok(!empty.includes('edition-art.jpg'));
  const photographed=render(base.photos);
  assert.ok(photographed.includes('seller-photo.jpg'));
  assert.ok(!photographed.includes('edition-art.jpg'));
});

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

test('localization is an optional directory reference, not arbitrary text', () => {
  const localizationId = 'a1000000-0000-4000-8000-000000000001';
  assert.equal(marketCreateSchema.parse({...base, editionId: INITIAL_EDITIONS[0]!.id, localizationId}).localizationId, localizationId);
  assert.equal(marketCreateSchema.parse({...base, editionId: INITIAL_EDITIONS[0]!.id, localizationId: null}).localizationId, null);
  assert.equal(marketCreateSchema.safeParse({...base, editionId: INITIAL_EDITIONS[0]!.id, localizationId: 'Русский интерфейс'}).success, false);
});

test('market status filter matches a directory reference and resets to all entries', () => {
  const entries = [{...INITIAL_MARKET_ENTRIES[0]!,statusId:'active-id'}, {...INITIAL_MARKET_ENTRIES[0]!,id:'closed-item',statusId:'closed-id'}];
  const games = new Map(INITIAL_GAMES.map(game=>[game.id,game]));
  const editions = new Map(INITIAL_EDITIONS.map(edition=>[edition.id,edition]));
  const filters = {query:'',itemType:'',platform:'',lang:'',yearRange:'',region:'',edition:'',completeness:'',statusId:'closed-id'};
  assert.deepEqual(selectVisibleMarketEntries(entries,games,editions,INITIAL_EDITIONS,filters).map(entry=>entry.id),['closed-item']);
  assert.equal(selectVisibleMarketEntries(entries,games,editions,INITIAL_EDITIONS,{...filters,statusId:''}).length,2);
});
