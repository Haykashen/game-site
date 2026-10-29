import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { Prisma, type PrismaClient } from '@prisma/client';
import { adminRecordKey } from '../shared/src/adminData.ts';
import { AppError } from '../server/src/errors.ts';
import { getTable, models, parseCreateData, parseData, recordSelect } from '../server/src/admin/metadata.ts';
import { buildWhere, registerAdminDataRoutes, userScopeWhere } from '../server/src/admin/routes.ts';
import { registerUserAdminRoutes } from '../server/src/users/adminRoutes.ts';
import { isUserOnline, ONLINE_WINDOW_MS, touchPresence } from '../server/src/auth/presence.ts';
import { validateRecord, reconcileRecords } from '../server/src/admin/rules.ts';
import { verifyPassword } from '../server/src/auth/password.ts';

type Row = Record<string, unknown>;
const adminId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-10-27T00:00:00.000Z');

/** A small recording adapter exercises HTTP/auth/validation without a live database. */
async function fixture() {
  const calls: {model: string; method: string; args: Row}[] = [];
  const rows = new Map<string, Row[]>();
  const db: Record<string, unknown> = {};
  for (const model of models) {
    const key = model.name.charAt(0).toLowerCase() + model.name.slice(1);
    rows.set(key, []);
    const match = (row: Row, where: Row = {}): boolean => Object.entries(where).every(([field, value]) => {
      if (field === 'AND') return (value as Row[]).every((clause) => match(row, clause));
      if (field === 'OR') return (value as Row[]).some((clause) => match(row, clause));
      if (value && typeof value === 'object' && 'contains' in value) return String(row[field]).toLowerCase().includes(String(value.contains).toLowerCase());
      return row[field] === value;
    });
    const select = (row: Row, selection?: Row) => selection ? Object.fromEntries(Object.keys(selection).map((field) => [field, row[field]])) : {...row};
    db[key] = Object.fromEntries(['findFirst', 'findUnique', 'findMany', 'groupBy', 'count', 'create', 'update', 'delete', 'deleteMany'].map((method) => [method, async (args: Row) => {
      calls.push({model: key, method, args});
      const list = rows.get(key)!;
      const where = args.where as Row | undefined;
      const found = list.find((row) => match(row, where));
      if (method === 'groupBy') return [];
      if (method === 'findMany') return list.filter((row) => match(row, where)).slice(Number(args.skip ?? 0), Number(args.skip ?? 0) + Number(args.take ?? 100)).map((row) => select(row, args.select as Row));
      if (method === 'findFirst' || method === 'findUnique') return found ? select(found, args.select as Row) : null;
      if (method === 'count') return list.filter((row) => match(row, where)).length;
      if (method === 'create') {
        const data = {id: otherId, role: 'user', status: 'active', createdAt: now, updatedAt: now, ...args.data as Row};
        list.push(data); return select(data, args.select as Row);
      }
      if (method === 'deleteMany') {const remaining = list.filter((row) => !match(row, where)); rows.set(key, remaining); return {count: list.length - remaining.length};}
      if (!found) throw new Error('Missing fixture row');
      if (method === 'delete') {list.splice(list.indexOf(found), 1); return found;}
      Object.assign(found, args.data); return select(found, args.select as Row);
    }]));
  }
  db.$transaction = async (action: (tx: unknown) => unknown) => action(db);
  const app = Fastify({routerOptions: {maxParamLength: 2000}});
  app.decorate('prisma', db as unknown as PrismaClient);
  app.decorateRequest('user', null);
  app.decorate('authenticate', async (request) => {
    const role = request.headers['x-test-role'];
    request.user = role ? {id: adminId, email: 'admin@test.invalid', displayName: 'Admin', role: role as 'admin' | 'user' | 'moderator', status: 'active', isDemo: false} : null;
  });
  app.setErrorHandler((error, _request, reply) => {
    const status = error instanceof AppError ? error.statusCode : 500;
    reply.code(status).send({error: {message: error.message, code: error instanceof AppError ? error.code : 'TEST_ERROR'}});
  });
  registerAdminDataRoutes(app);
  registerUserAdminRoutes(app);
  await app.ready();
  return {app, rows, calls};
}
const headers = {'x-test-role': 'admin'};
const path = (model: string, key?: Row) => '/api/v1/admin/data/' + model + '/records' + (key ? '/' + encodeURIComponent(JSON.stringify(key)) : '');

test('all database models are covered and credentials never enter public metadata or select', () => {
  assert.deepEqual(models.map((model) => model.name).sort(), Prisma.dmmf.datamodel.models.map((model) => model.name).sort());
  for (const model of models) {
    const table = getTable(model.name);
    assert.ok(table.primaryKey.length);
    assert.ok(!table.fields.some((field) => /Hash$/.test(field.name)));
    assert.ok(!('password' in recordSelect(table)));
  }
  for (const key of ['ratingSum', 'ratingCount']) assert.equal(getTable('User').fields.find((field) => field.name === key)?.readOnly, true);
  assert.equal(getTable('Session').canCreate, false);
  assert.equal(getTable('Session').canEdit, false);
  assert.equal(getTable('Edition').fields.find((field) => field.name === 'releaseDate')?.dateOnly, true);
});

test('strict write schemas reject statistics, secrets, primary key changes, nested writes and invalid values', () => {
  for (const data of [{ratingSum: 99}, {ratingCount: 9}, {lastSeenAt: now.toISOString()}, {passwordHash: 'hash'}, {copies: {deleteMany: {}}}, {role: 'owner'}, {email: 'invalid'}, {password: 'short'}, {id: otherId}]) {
    assert.throws(() => parseData(getTable('User'), data, false), AppError);
  }
  assert.throws(() => parseData(getTable('User'), {displayName: 'Valid', email: 'valid@test.invalid'}, true), AppError);
  assert.throws(() => parseData(getTable('GameRating'), {userId: otherId, gameId: 'game', score: 11}, true), AppError);
  assert.throws(() => parseData(getTable('Review'), {rating: 0}, false), AppError);
  assert.throws(() => parseData(getTable('Copy'), {purchasePriceMinor: -1}, false), AppError);
  assert.throws(() => parseData(getTable('Game'), {title: ' ', publisher: 'Test', description: 'test'}, true), AppError);
  assert.equal(parseData(getTable('User'), {email: ' ADMIN@Test.Invalid '}, false).email, 'admin@test.invalid');
});

test('all standalone IDs are generated and hidden from editable creation fields', () => {
  for (const model of models) {
    const field = getTable(model.name).fields.find((item) => item.name === 'id');
    if (!field) continue;
    assert.equal(field.readOnly, true, model.name);
    assert.equal(field.generated, true, model.name);
    assert.equal(field.required, false, model.name);
  }
  const ratings = getTable('GameRating');
  for (const name of ['userId', 'gameId']) {
    const field = ratings.fields.find((item) => item.name === name)!;
    assert.equal(field.readOnly, false);
    assert.equal(field.required, true);
    assert.ok(field.reference);
  }
});

test('server supplies distinct game and edition UUIDs; Prisma defaults and compound keys stay intact', () => {
  const body = {title: 'Game', publisher: 'Test', description: 'Description', genres: []};
  const first = parseCreateData(getTable('Game'), body);
  const second = parseCreateData(getTable('Game'), body);
  const edition = parseCreateData(getTable('Edition'), {gameId: first.id, name: 'Standard', platform: 'PS5', region: 'RU', lang: 'Русский', media: 'Disc', contents: [], coverImages: []});
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  for (const data of [first, second, edition]) assert.match(String(data.id), uuid);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.id, edition.id);
  assert.equal(edition.gameId, first.id);
  const user = parseCreateData(getTable('User'), {email: 'new@test.invalid', displayName: 'New user', password: 'test-password'});
  assert.ok(!Object.hasOwn(user, 'id'));
  const rating = parseCreateData(getTable('GameRating'), {userId: otherId, gameId: first.id, score: 8});
  assert.deepEqual(rating, {userId: otherId, gameId: first.id, score: 8});
  assert.throws(() => parseCreateData(getTable('Game'), {...body, id: 'client-controlled'}), AppError);
  assert.throws(() => parseCreateData(getTable('User'), {...user, id: otherId}), AppError);
});

test('HTTP creation accepts no client ID, returns a generated ID, and keeps legacy IDs on edit', async () => {
  const {app, rows} = await fixture();
  const payload = {title: 'Generated', publisher: 'Test', description: 'Description', genres: []};
  try {
    const injected = await app.inject({method: 'POST', url: path('Game'), headers, payload: {...payload, id: 'custom'}});
    assert.equal(injected.statusCode, 400, injected.body);
    const first = await app.inject({method: 'POST', url: path('Game'), headers, payload});
    const second = await app.inject({method: 'POST', url: path('Game'), headers, payload: {...payload, title: 'Other'}});
    assert.equal(first.statusCode, 201, first.body);
    assert.equal(second.statusCode, 201, second.body);
    assert.notEqual(first.json().record.id, second.json().record.id);
    rows.get('game')!.push({id: 'legacy-game-slug', title: 'Legacy', updatedAt: now});
    const edited = await app.inject({method: 'PATCH', url: path('Game', {id: 'legacy-game-slug'}), headers, payload: {data: {title: 'Renamed legacy game'}, expectedUpdatedAt: now.toISOString()}});
    assert.equal(edited.statusCode, 200, edited.body);
    assert.equal(edited.json().record.id, 'legacy-game-slug');
  } finally {await app.close();}
});

test('global and per-column filters validate types and cannot inject arbitrary Prisma conditions', () => {
  assert.deepEqual(buildWhere(getTable('Game'), '', JSON.stringify({year: '2024', genres: 'RPG'})), {AND: [{year: 2024}, {genres: {has: 'RPG'}}]});
  const uuid = buildWhere(getTable('Copy'), '', JSON.stringify({userId: otherId}));
  assert.deepEqual(uuid, {AND: [{userId: otherId}]});
  assert.throws(() => buildWhere(getTable('Copy'), '', JSON.stringify({userId: 'substring'})), AppError);
  assert.throws(() => buildWhere(getTable('User'), '', JSON.stringify({passwordHash: 'x'})), AppError);
  assert.throws(() => buildWhere(getTable('User'), '', JSON.stringify({role: 'owner'})), AppError);
  assert.throws(() => buildWhere(getTable('Game'), '', JSON.stringify({year: 'NaN'})), AppError);
  assert.throws(() => buildWhere(getTable('Game'), '', JSON.stringify({year: '2147483648'})), AppError);
  assert.throws(() => buildWhere(getTable('Game'), '', JSON.stringify({createdAt: '2026-02-30'})), AppError);
  assert.throws(() => buildWhere(getTable('Game'), '', '{bad json'), AppError);
});

test('administrative endpoints reject guests and regular users before database access', async () => {
  const {app, calls} = await fixture();
  try {
    for (const role of [undefined, 'user']) {
      for (const [method, url, payload] of [
        ['GET', '/api/v1/admin/data', undefined], ['GET', path('User'), undefined],
        ['GET', path('User', {id: otherId}), undefined], ['GET', '/api/v1/admin/data/User/references', undefined],
        ['POST', path('Game'), {}], ['PATCH', path('User', {id: otherId}), {}], ['DELETE', path('User', {id: otherId}), {}],
      ] as const) {
        const result = await app.inject({method, url, headers: role ? {'x-test-role': role} : {}, ...(payload ? {payload} : {})});
        assert.equal(result.statusCode, role ? 403 : 401, method + ' ' + url);
      }
    }
    assert.equal(calls.length, 0);
  } finally {await app.close();}
});

test('game CRUD uses explicit scalar fields, pagination and optimistic concurrency', async () => {
  const {app, calls} = await fixture();
  try {
    const create = await app.inject({method: 'POST', url: path('Game'), headers, payload: {title: 'New game', publisher: 'Test', description: 'Description', genres: []}});
    assert.equal(create.statusCode, 201, create.body);
    const id = create.json().record.id;
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const list = await app.inject({method: 'GET', url: path('Game') + '?page=1&pageSize=20&sortBy=title&sortDir=asc', headers});
    assert.equal(list.statusCode, 200, list.body);
    assert.equal(list.json().items[0].title, 'New game');
    assert.equal(list.json().total, 1);
    const find = calls.find((call) => call.model === 'game' && call.method === 'findMany')!;
    assert.deepEqual(find.args.orderBy, [{title: 'asc'}, {id: 'asc'}]);
    const stale = await app.inject({method: 'PATCH', url: path('Game', {id}), headers, payload: {data: {title: 'Lost update'}, expectedUpdatedAt: '2020-01-01T00:00:00.000Z'}});
    assert.equal(stale.statusCode, 409);
    assert.equal(stale.json().error.code, 'STALE_RECORD');
    const patch = await app.inject({method: 'PATCH', url: path('Game', {id}), headers, payload: {data: {title: 'Edited'}, expectedUpdatedAt: now.toISOString()}});
    assert.equal(patch.statusCode, 200, patch.body);
    assert.equal(patch.json().record.title, 'Edited');
    const remove = await app.inject({method: 'DELETE', url: path('Game', {id}), headers, payload: {expectedUpdatedAt: now.toISOString()}});
    assert.equal(remove.statusCode, 204, remove.body);
    const missing = await app.inject({method: 'GET', url: path('Game', {id}), headers});
    assert.equal(missing.statusCode, 404);
  } finally {await app.close();}
});

test('creating users hashes passwords, hides hashes, and editing a password revokes sessions', async () => {
  const {app, rows} = await fixture();
  try {
    const result = await app.inject({method: 'POST', url: path('User'), headers, payload: {email: 'new@test.invalid', displayName: 'New user', password: 'test-password'}});
    assert.equal(result.statusCode, 201, result.body);
    assert.ok(!result.body.includes('password'));
    const stored = rows.get('user')![0]!;
    assert.notEqual(stored.passwordHash, 'test-password');
    assert.ok(await verifyPassword(String(stored.passwordHash), 'test-password'));
    rows.get('session')!.push({id: 'session', userId: otherId});
    const patch = await app.inject({method: 'PATCH', url: path('User', {id: otherId}), headers, payload: {data: {password: 'changed-password'}, expectedUpdatedAt: now.toISOString()}});
    assert.equal(patch.statusCode, 200, patch.body);
    assert.equal(rows.get('session')!.length, 0);
    assert.ok(await verifyPassword(String(stored.passwordHash), 'changed-password'));
    const read = await app.inject({method: 'GET', url: path('User', {id: otherId}), headers});
    assert.ok(!read.body.includes('password'));
  } finally {await app.close();}
});

test('own administrator account cannot be deleted, suspended or demoted', async () => {
  const {app, rows} = await fixture();
  rows.get('user')!.push({id: adminId, email: 'admin@test.invalid', displayName: 'Admin', role: 'admin', status: 'active', updatedAt: now});
  try {
    for (const data of [{role: 'user'}, {status: 'suspended'}, {status: 'deleted'}, {isDemo: true}]) {
      const result = await app.inject({method: 'PATCH', url: path('User', {id: adminId}), headers, payload: {data, expectedUpdatedAt: now.toISOString()}});
      assert.equal(result.statusCode, 403, result.body);
    }
    const result = await app.inject({method: 'DELETE', url: path('User', {id: adminId}), headers, payload: {expectedUpdatedAt: now.toISOString()}});
    assert.equal(result.statusCode, 403);
  } finally {await app.close();}
});

test('last active administrator cannot be removed even when the acting identity differs', async () => {
  const {app, rows} = await fixture();
  rows.get('user')!.push({id: otherId, role: 'admin', status: 'active', isDemo: false, updatedAt: now});
  try {
    const result = await app.inject({method: 'PATCH', url: path('User', {id: otherId}), headers, payload: {data: {role: 'user'}, expectedUpdatedAt: now.toISOString()}});
    assert.equal(result.statusCode, 403, result.body);
    assert.match(result.json().error.message, /активный администратор/);
  } finally {await app.close();}
});

test('session token hashes never appear in record or paginated responses', async () => {
  const {app, rows} = await fixture();
  rows.get('session')!.push({id: otherId, userId: adminId, tokenHash: 'must-never-appear', expiresAt: now, createdAt: now, lastUsedAt: now});
  try {
    for (const url of [path('Session'), path('Session', {id: otherId})]) {
      const result = await app.inject({method: 'GET', url, headers});
      assert.equal(result.statusCode, 200, result.body);
      assert.ok(!result.body.includes('tokenHash'));
      assert.ok(!result.body.includes('must-never-appear'));
    }
  } finally {await app.close();}
});

test('dependent rows block deletion with an actionable table name', async () => {
  const {app, rows} = await fixture();
  rows.get('game')!.push({id: 'game', updatedAt: now});
  rows.get('edition')!.push({id: 'edition', gameId: 'game'});
  try {
    const result = await app.inject({method: 'DELETE', url: path('Game', {id: 'game'}), headers, payload: {expectedUpdatedAt: now.toISOString()}});
    assert.equal(result.statusCode, 409, result.body);
    assert.match(result.json().error.message, /Издания: 1/);
    assert.equal(rows.get('game')!.length, 1);
  } finally {await app.close();}
});

test('composite keys are routed intact and unknown tables and sort columns are rejected', async () => {
  const {app, rows} = await fixture();
  const record = {userId: otherId, gameId: 'long-game-' + 'x'.repeat(80), score: 8, updatedAt: now};
  rows.get('gameRating')!.push(record);
  try {
    const key = adminRecordKey(getTable('GameRating'), {...record, updatedAt: now.toISOString()});
    const result = await app.inject({method: 'GET', url: '/api/v1/admin/data/GameRating/records/' + encodeURIComponent(key), headers});
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.json().record.score, 8);
    assert.equal((await app.inject({method: 'GET', url: path('Unknown'), headers})).statusCode, 404);
    assert.equal((await app.inject({method: 'GET', url: path('User', {id: 'invalid-uuid'}), headers})).statusCode, 400);
    assert.equal((await app.inject({method: 'GET', url: path('User') + '?sortBy=passwordHash', headers})).statusCode, 400);
    assert.equal((await app.inject({method: 'POST', url: path('Session'), headers, payload: {}})).statusCode, 403);
    assert.equal((await app.inject({method: 'PATCH', url: path('Session', {id: otherId}), headers, payload: {}})).statusCode, 403);
  } finally {await app.close();}
});

test('review corrections rebuild cached ratings for both previous and new recipient', async () => {
  const updates: Row[] = [];
  const tx = {review: {aggregate: async ({where}: {where: {targetId: string}}) => ({_sum: {rating: where.targetId === adminId ? null : 5}, _count: {_all: where.targetId === adminId ? 0 : 1}})}, user: {update: async (args: Row) => {updates.push(args);}}} as unknown as Prisma.TransactionClient;
  await reconcileRecords(tx, 'Review', {targetId: adminId}, {targetId: otherId});
  assert.deepEqual(updates, [{where: {id: adminId}, data: {ratingSum: 0, ratingCount: 0}}, {where: {id: otherId}, data: {ratingSum: 5, ratingCount: 1}}]);
});

test('domain validation prevents wrong edition/game links, self-deals, review spoofing and cyclic comments', async () => {
  const tx = {
    edition: {findUnique: async () => ({gameId: 'other-game', canonicalId: null})},
    deal: {findUnique: async () => ({status: 'completed', buyerId: adminId, sellerId: otherId})},
    discussionComment: {findUnique: async () => ({discussionId: 'thread', parentId: 'self'})},
  } as unknown as Prisma.TransactionClient;
  await assert.rejects(validateRecord(tx, 'MarketEntry', {editionId: 'edition', gameId: 'game'}, null), AppError);
  await assert.rejects(validateRecord(tx, 'Deal', {buyerId: adminId, sellerId: adminId}, null), AppError);
  await assert.rejects(validateRecord(tx, 'Review', {authorId: adminId, targetId: adminId}, null), AppError);
  await assert.rejects(validateRecord(tx, 'DiscussionComment', {id: 'self', discussionId: 'thread', parentId: 'parent'}, null), AppError);
});

test('presence has a two-minute cutoff, and suspended users cannot appear online', () => {
  assert.equal(isUserOnline('active', now, now), true);
  assert.equal(isUserOnline('active', new Date(now.getTime() - ONLINE_WINDOW_MS), now), true);
  assert.equal(isUserOnline('active', new Date(now.getTime() - ONLINE_WINDOW_MS - 1), now), false);
  assert.equal(isUserOnline('active', null, now), false);
  assert.equal(isUserOnline('suspended', now, now), false);
  assert.equal(isUserOnline('deleted', now, now), false);
  assert.equal(isUserOnline('active', new Date(now.getTime() + 1000), now), false);
});

test('presence writes are throttled and a concurrently revoked session cannot refresh a user', async () => {
  let persisted = 0;
  let count = 1;
  const calls: Row[] = [];
  const tx = {session: {updateMany: async (args: Row) => {calls.push(args); return {count};}}, $executeRaw: async () => {persisted += 1;}};
  const prisma = {$transaction: async (action: (value: unknown) => Promise<void>) => action(tx)} as unknown as PrismaClient;
  await touchPresence(prisma, otherId, adminId, now);
  assert.equal(persisted, 1);
  assert.deepEqual(calls[0], {where: {id: otherId, userId: adminId, expiresAt: {gt: now}, lastUsedAt: {lte: new Date(now.getTime() - 60000)}}, data: {lastUsedAt: now}});
  count = 0;
  await touchPresence(prisma, otherId, adminId, now);
  assert.equal(persisted, 1);
});

test('related user scope includes both sides of deals and all user roles in notifications', () => {
  assert.deepEqual(userScopeWhere(getTable('Deal'), otherId), {OR: [{buyerId: otherId}, {sellerId: otherId}]});
  assert.deepEqual(userScopeWhere(getTable('Copy'), otherId), {OR: [{userId: otherId}]});
  assert.deepEqual(userScopeWhere(getTable('Notification'), otherId), {OR: [{userId: otherId}, {actorId: otherId}]});
  assert.throws(() => userScopeWhere(getTable('Game'), otherId), AppError);
});

test('related records are scoped before pagination and cannot be broadened by column filters', async () => {
  const {app, rows} = await fixture();
  rows.get('deal')!.push(
    {id: '33333333-3333-4333-8333-333333333333', buyerId: otherId, sellerId: adminId},
    {id: '44444444-4444-4444-8444-444444444444', buyerId: adminId, sellerId: otherId},
    {id: '55555555-5555-4555-8555-555555555555', buyerId: adminId, sellerId: adminId},
  );
  try {
    const url = path('Deal') + '?relatedUserId=' + otherId;
    const result = await app.inject({method: 'GET', url: url + '&pageSize=1&page=1', headers});
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.json().total, 2);
    assert.equal(result.json().items.length, 1);
    const second = await app.inject({method: 'GET', url: url + '&pageSize=1&page=2', headers});
    assert.equal(second.json().items[0].id, '44444444-4444-4444-8444-444444444444');
    const filtered = await app.inject({method: 'GET', url: url + '&filters=' + encodeURIComponent(JSON.stringify({id: '55555555-5555-4555-8555-555555555555'})), headers});
    assert.equal(filtered.statusCode, 200, filtered.body);
    assert.equal(filtered.json().total, 0);
    assert.equal((await app.inject({method: 'GET', url: path('Game') + '?relatedUserId=' + otherId, headers})).statusCode, 400);
    assert.equal((await app.inject({method: 'GET', url: path('Deal') + '?relatedUserId=not-a-uuid', headers})).statusCode, 400);
  } finally {await app.close();}
});

test('user directory exposes last visit, online filters and ID filters without session data', async () => {
  const {app, rows} = await fixture();
  const recent = new Date();
  const old = new Date(recent.getTime() - 600000);
  const user = (id: string, lastSeenAt: Date | null, sessions: Row[]) => ({id, email: id + '@test.invalid', displayName: id, role: 'user', status: 'active', isDemo: false, createdAt: old, lastSeenAt, sessions, ratingSum: 0, ratingCount: 0, _count: {copies: 0}});
  rows.get('user')!.push(user(adminId, recent, [{lastUsedAt: recent, expiresAt: new Date(recent.getTime() + 600000)}]), user(otherId, old, []));
  try {
    const online = await app.inject({method: 'GET', url: '/api/v1/admin/users?online=online', headers});
    assert.equal(online.statusCode, 200, online.body);
    assert.equal(online.json().items.length, 1);
    assert.equal(online.json().items[0].id, adminId);
    assert.equal(online.json().items[0].isOnline, true);
    assert.equal(online.json().items[0].lastSeenAt, recent.toISOString());
    assert.ok(!online.body.includes('sessions'));
    const offline = await app.inject({method: 'GET', url: '/api/v1/admin/users?online=offline&id=' + otherId.slice(0, 8) + '&sortBy=lastSeenAt', headers});
    assert.equal(offline.statusCode, 200, offline.body);
    assert.equal(offline.json().items[0].id, otherId);
    assert.equal(offline.json().items[0].lastSeenAt, old.toISOString());
    const forbidden = await app.inject({method: 'GET', url: '/api/v1/admin/users', headers: {'x-test-role': 'moderator'}});
    assert.equal(forbidden.statusCode, 403);
  } finally {await app.close();}
});

test('moderators can edit games but cannot create, delete or access other tables', async () => {
  const {app, rows} = await fixture();
  const moderator = {'x-test-role': 'moderator'};
  rows.get('game')!.push({id: 'moderated-game', title: 'Original', updatedAt: now});
  try {
    const metadata = await app.inject({method: 'GET', url: '/api/v1/admin/data', headers: moderator});
    assert.equal(metadata.statusCode, 200);
    assert.deepEqual(metadata.json().tables.map((table: {name: string}) => table.name), ['Game']);
    assert.equal(metadata.json().tables[0].canCreate, false);
    assert.equal(metadata.json().tables[0].canDelete, false);
    const read = await app.inject({method: 'GET', url: path('Game', {id: 'moderated-game'}), headers: moderator});
    assert.equal(read.statusCode, 200, read.body);
    const edit = await app.inject({method: 'PATCH', url: path('Game', {id: 'moderated-game'}), headers: moderator, payload: {data: {title: 'Updated'}, expectedUpdatedAt: now.toISOString()}});
    assert.equal(edit.statusCode, 200, edit.body);
    assert.equal(edit.json().record.title, 'Updated');
    for (const [method, url, payload] of [
      ['GET', path('User'), undefined], ['GET', path('User', {id: otherId}), undefined],
      ['POST', path('Game'), {}], ['DELETE', path('Game', {id: 'moderated-game'}), undefined],
      ['PATCH', path('User', {id: otherId}), {data: {displayName: 'Forbidden'}}],
    ] as const) {
      const response = await app.inject({method, url, headers: moderator, ...(payload ? {payload} : {})});
      assert.equal(response.statusCode, 403, method + ' ' + url + ': ' + response.body);
    }
  } finally { await app.close(); }
});
test('game series is a nullable reference, not an editable title string', () => {
  const table = getTable('Game');
  assert.equal(table.fields.some(field => field.name === 'series'), false);
  const series = table.fields.find(field => field.name === 'seriesId')!;
  assert.equal(series.reference, 'GameSeries');
  assert.equal(series.nullable, true);
  assert.equal(parseData(table, {seriesId: null}, false).seriesId, null);
  assert.throws(() => parseData(table, {series: 'Free text'}, false), AppError);
});