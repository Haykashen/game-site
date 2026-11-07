import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {copyEditorValues, copyEditorDirty, copyEditorDetails, reorderPhoto} from '../src/lib/copyEditor.ts';
import {PhotoPicker} from '../src/components/market/PhotoPicker.tsx';
import {mapCopy} from '../src/api/mappers.ts';
import type {Copy, Edition} from '../src/types.ts';
const copy: Copy = {id: 'copy', editionId: 'edition', condition: '10', completeness: 'CIB', purchasePrice: 50000.5, purchaseDate: '2026-11-07', notes: 'Keep', photos: ['https://example.com/one.jpg', 'https://example.com/two.jpg'], createdAt: ''};
const edition = {id: 'edition', region: 'EUR'} as Edition;
const initial = () => copyEditorValues(copy, edition, copy.photos, 2);
test('copy editor compares numeric prices and preserves the initial snapshot', () => {
  const before = initial(); const after = {...before, purchasePrice: '50 000,50'};
  assert.equal(copyEditorDirty(before, after), false);
  after.photos = reorderPhoto(after.photos, 0, 1);
  assert.equal(copyEditorDirty(before, after), true);
  assert.deepEqual(before.photos, copy.photos);
  after.photos = [...before.photos]; assert.equal(copyEditorDirty(before, after), false);
  assert.equal(copyEditorDirty(before, {...after, quantity: 3}), true);
});
test('copy edits retain inherited regions unless changed and include quantity and photo order together', () => {
  const before = initial(); const unchanged = copyEditorDetails(before, {...before, notes: 'Updated'});
  assert.ok(!('region' in unchanged)); assert.ok(!('photos' in unchanged));
  const changed = copyEditorDetails(before, {...before, region: 'JPN', quantity: 3, photos: [...before.photos].reverse(), purchasePrice: '12 345,67'});
  assert.equal(changed.region, 'JPN'); assert.equal(changed.quantity, 3); assert.equal(changed.purchasePrice, 12345.67);
  assert.deepEqual(changed.photos, [...before.photos].reverse());
  assert.equal(copyEditorDetails(before, {...before, region: ''}).region, '');
  assert.throws(() => copyEditorDetails(before, {...before, purchasePrice: 'invalid'}));
  assert.throws(() => copyEditorDetails(before, {...before, quantity: 100}));
  assert.throws(() => copyEditorDetails(before, {...before, purchaseDate: '2026-02-30'}));
});
test('legacy photo groups can retain their photos when only text changes', () => {
  const before = {...initial(), photos: Array.from({length: 7}, (_, i) => `https://example.com/${i}.jpg`)};
  assert.equal(copyEditorDetails(before, {...before, notes: 'Updated'}).photos, undefined);
  assert.throws(() => copyEditorDetails(before, {...before, photos: [...before.photos].reverse()}));
});
test('photo reorder does not mutate input and ignores invalid destinations', () => {
  const photos = ['a', 'b', 'c'];
  assert.deepEqual(reorderPhoto(photos, 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(reorderPhoto(photos, 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(reorderPhoto(photos, 0, -1), photos); assert.deepEqual(photos, ['a', 'b', 'c']);
});
test('read-only gallery renders selectors but no photo mutation controls or help', () => {
  const render = (readOnly: boolean) => renderToStaticMarkup(createElement(PhotoPicker, {photos: copy.photos, onChange() {}, onSelect() {}, selectedIndex: 0, sortable: true, readOnly}));
  const view = render(true); assert.ok(view.includes('Показать фото 1')); assert.ok(!view.includes('Удалить фото')); assert.ok(!view.includes('Добавить фото')); assert.ok(!view.includes('Перетащите'));
  const edit = render(false); assert.ok(edit.includes('Удалить фото 1')); assert.ok(edit.includes('Добавить фото')); assert.ok(edit.includes('Перетащите'));
});
test('copy mapping preserves personal and explicitly unspecified regions', () => {
  assert.equal(mapCopy({...copy, region: 'JPN', updatedAt: ''}).region, 'JPN');
  assert.equal(mapCopy({...copy, region: '', updatedAt: ''}).region, '');
});
