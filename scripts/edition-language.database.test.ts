import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { normalizeEditionLanguage } from '../shared/src/catalog.ts';
const isolated = process.env.CI === 'true' && (process.env.DATABASE_URL ?? '').includes('/discvault_ci');
test('database normalizes language writes and preserves edition identity', {skip: !isolated}, async () => {
  const db = new PrismaClient(), id = randomUUID();
  try {
    for (const input of ['русский', 'РУССКИЙ', '  Русский  ', 'Не указан', '', 'русский; АНГЛИЙСКИЙ, русский, Не указан', 'Японский']) {
      const rows = await db.$queryRawUnsafe<{value: string}[]>('SELECT normalize_edition_language($1) AS value', input);
      assert.equal(rows[0]!.value, normalizeEditionLanguage(input));
    }
    await db.game.create({data: {id, title: id, publisher: '', description: ''}});
    const edition = await db.edition.create({data: {id, gameId: id, name: 'Test', platform: 'PS5', lang: 'русский, Русский', media: 'Disc', contents: [], coverImages: []}});
    assert.equal(edition.lang, 'Русский');
    const changed = await db.edition.update({where: {id}, data: {lang: 'Русский; английский'}});
    assert.equal(changed.lang, 'Английский, Русский');
    assert.equal(changed.id, edition.id);
    assert.equal(changed.gameId, edition.gameId);
    assert.equal(changed.statusId, edition.statusId);
  } finally {await db.game.deleteMany({where: {id}}); await db.$disconnect();}
});
