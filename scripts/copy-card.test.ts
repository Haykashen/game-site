import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CopyCard} from '../src/components/collection/CopyCard.tsx';
import type {Copy, Edition, Game} from '../src/types.ts';
const copy: Copy = {id: 'copy', editionId: 'edition', condition: 'New', completeness: 'CIB', purchasePrice: null, purchaseDate: '', notes: '', photos: [], createdAt: ''};
const edition = {id: 'edition', gameId: 'game', name: 'Standard', platform: 'PS5', region: 'EUR', coverImages: ['https://example.com/catalogue.jpg'], contents: []} as unknown as Edition;
const game = {id: 'game', title: 'Test game'} as Game;
const render = (item: Copy, photos?: string[]) => renderToStaticMarkup(createElement(CopyCard, {
  copy: item, edition, game, quantity: 1, ...(photos ? {photos} : {}), onOpen() {}, onEdit() {}, onQuantityChange() {}, onRemove() {},
}));
test('collection cards display user photos and never substitute edition artwork', () => {
  const uploaded = render({...copy, photos: ['https://example.com/my-copy.jpg']});
  assert.ok(uploaded.includes('src="https://example.com/my-copy.jpg"'));
  assert.ok(!uploaded.includes('catalogue.jpg'));
  const empty = render(copy);
  assert.ok(empty.includes('copy-card__placeholder'));
  assert.ok(!empty.includes('catalogue.jpg'));
});
test('a grouped card can use photos attached to another copy of the edition', () => {
  const grouped = render(copy, ['https://example.com/second-copy.jpg']);
  assert.ok(grouped.includes('src="https://example.com/second-copy.jpg"'));
  assert.ok(!grouped.includes('catalogue.jpg'));
});
