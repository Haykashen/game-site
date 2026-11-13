import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEditionLanguage } from '../shared/src/catalog.ts';
import {createRequire} from 'node:module';
const {editionKey} = createRequire(import.meta.url)('./lib/edition-dedup.cjs');
test('language values have one identity without losing multilingual releases', () => {
  for (const value of ['русский', 'РУССКИЙ', '  Русский  ']) assert.equal(normalizeEditionLanguage(value), 'Русский');
  for (const value of ['', 'Не указан', 'unknown']) assert.equal(normalizeEditionLanguage(value), 'Не указано');
  assert.equal(normalizeEditionLanguage('русский; АНГЛИЙСКИЙ, русский, Не указан'), 'Английский, Русский');
  const base = {gameId: 'game', platform: 'PS5', name: 'Standard', region: 'EUR', media: 'Disc'};
  assert.equal(editionKey({...base, lang: 'Русский, английский, русский'}), editionKey({...base, lang: 'английский; русский'}));
  assert.notEqual(editionKey({...base, lang: 'Русский'}), editionKey({...base, lang: 'Английский, Русский'}));
});
