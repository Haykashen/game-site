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
  copy: item, edition, game, quantity: 1, ...(photos ? {photos} : {}), onOpen() {}, onEdit() {}, onRemove() {},
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


test('multiple collection photos have one selector per unique photo and the first selected', () => {
  const html = render(copy, ['https://example.com/first.jpg', 'https://example.com/second.jpg', 'https://example.com/first.jpg']);
  assert.equal((html.match(/aria-pressed=/g) ?? []).length, 2);
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.ok(html.includes('Показать фото 2 из 2'));
  assert.ok(html.includes('src="https://example.com/first.jpg"'));
});

test('a single collection photo does not show gallery selectors', () => {
  const html = render(copy, ['https://example.com/first.jpg']);
  assert.ok(!html.includes('aria-pressed='));
});


test('collection shelf cards leave quantity changes to the copy detail', () => {
  const html = render(copy);
  assert.ok(!html.includes('Увеличить количество'));
  assert.ok(!html.includes('Уменьшить количество'));
  assert.ok(html.includes('Открыть экземпляр'));
});
