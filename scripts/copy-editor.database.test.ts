import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
import Fastify from 'fastify';
import {registerCollectionRoutes} from '../server/src/collection/routes.ts';
import {AppError} from '../server/src/errors.ts';
const isolated = process.env.CI === 'true' && (process.env.DATABASE_URL ?? '').includes('/discvault_ci');
test('personal region, ordered photos and quantity save atomically and remain owner scoped', {skip: !isolated ? 'Requires the isolated CI database discvault_ci.' : false}, async () => {
  const db = new PrismaClient(); const app = Fastify(); const owner = randomUUID(), other = randomUUID(), id = randomUUID();
  app.decorate('prisma', db); app.decorateRequest('user', null);
  app.decorate('authenticate', async request => {request.user = {id: request.headers['x-test-owner'] === 'other' ? other : owner} as any;});
  app.setErrorHandler((error, _request, reply) => reply.code(error instanceof AppError ? error.statusCode : 500).send({error: {message: error.message}}));
  registerCollectionRoutes(app);
  const path = `/api/v1/collection/editions/${id}`;
  try {
    await db.user.createMany({data: [owner, other].map(userId => ({id: userId, email: userId+'@test.invalid', displayName: 'Copy editor fixture', passwordHash: 'unused'}))});
    const region = await db.region.upsert({where: {code: 'COPY-EDITOR-TEST'}, update: {}, create: {code: 'COPY-EDITOR-TEST', name: 'Copy editor test region'}});
    await db.game.create({data: {id, title: 'Copy editor fixture', publisher: '', description: ''}});
    await db.edition.create({data: {id, gameId: id, name: 'Test', platform: 'PS5', regionId: region.id, media: 'Disc', contents: [], coverImages: []}});
    const original = await db.copy.create({data: {userId: owner, editionId: id, photos: {create: [{url: 'https://example.com/first.jpg', sortOrder: 0}, {url: 'https://example.com/second.jpg', sortOrder: 1}]}}});
    const unrelated = await db.copy.create({data: {userId: other, editionId: id}});
    const edit = await app.inject({method: 'PATCH', url: path, payload: {condition: '9', region: 'JPN', notes: 'Updated', purchasePrice: 12345.67, quantity: 3, photos: ['https://example.com/second.jpg', 'https://example.com/first.jpg']}});
    assert.equal(edit.statusCode, 200, edit.body);
    const items = edit.json(); assert.equal(items.length, 3); assert.ok(items.every((copy: any) => copy.region === 'JPN' && copy.purchasePrice === 12345.67 && copy.condition === '9'));
    assert.deepEqual(items[0].photos, ['https://example.com/second.jpg', 'https://example.com/first.jpg']);
    assert.equal((await db.copy.findUniqueOrThrow({where: {id: unrelated.id}})).region, null);
    assert.equal((await db.edition.findUniqueOrThrow({where: {id}})).regionId, region.id);
    const invalid = await app.inject({method: 'PATCH', url: path, payload: {region: 'USA', quantity: 100, photos: []}});
    assert.equal(invalid.statusCode, 400); assert.equal((await db.copy.findUniqueOrThrow({where: {id: original.id}})).region, 'JPN');
    const forbidden = await app.inject({method: 'PATCH', url: `/api/v1/collection/copies/${original.id}`, headers: {'x-test-owner': 'other'}, payload: {region: 'USA', photos: []}});
    assert.equal(forbidden.statusCode, 404);
    const clear = await app.inject({method: 'PATCH', url: path, payload: {region: '', photos: [], quantity: 1}});
    assert.equal(clear.statusCode, 200, clear.body); assert.equal(clear.json().length, 1); assert.equal(clear.json()[0].region, ''); assert.deepEqual(clear.json()[0].photos, []);
    const inherited = await app.inject({method: 'PATCH', url: path, payload: {region: null}}); assert.equal(inherited.json()[0].region, null);
    const added = await app.inject({method: 'POST', url: '/api/v1/collection/copies', payload: {editionId: id, region: 'EUR'}}); assert.equal(added.statusCode, 201, added.body); assert.equal(added.json().region, 'EUR');
  } finally {
    await app.close(); await db.copy.deleteMany({where: {editionId: id}}); await db.edition.deleteMany({where: {id}}); await db.game.deleteMany({where: {id}}); await db.user.deleteMany({where: {id: {in: [owner, other]}}}); await db.region.deleteMany({where: {code: 'COPY-EDITOR-TEST'}}); await db.$disconnect();
  }
});
