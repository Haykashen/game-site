import test from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import { marketStatus, moderationStatus, marketStatusWhere, statusWrite } from '../server/src/lib/statusSource.ts';
import { getTable, recordSelect, parseData } from '../server/src/admin/metadata.ts';
import { resolveStatus, scalarStatusData } from '../server/src/lib/statusDirectories.ts';

const record = (code: string) => ({statusReference: {code}});

test('market API projections preserve draft, rejection and terminal states from one code', () => {
  for (const [code, lifecycle, moderation] of [
    ['draft','active','draft'], ['pending','active','pending'], ['rejected','active','hidden'],
    ['removed','active','removed'], ['active','active','visible'], ['sold','sold','visible'], ['closed','closed','visible'],
  ]) {
    assert.equal(marketStatus(record(code!)), lifecycle);
    assert.equal(moderationStatus(record(code!)), moderation);
  }
  assert.deepEqual(marketStatusWhere({status: 'active', moderationStatus: 'visible'}), {statusReference: {code: {in: ['active']}}});
  assert.deepEqual(marketStatusWhere({moderationStatus: 'visible'}), {statusReference: {code: {in: ['active','sold','closed']}}});
  assert.deepEqual(marketStatusWhere({status: 'active'}), {statusReference: {code: {in: ['draft','pending','active','rejected','removed']}}});
});

function database(old: {kind: string; statusReference: {code: string}} | null = null) {
  const lookups: unknown[] = [];
  const tx = {
    marketEntry: {findFirst: async () => old},
    status: {findUnique: async (args: {where: {entity_code?: {entity: string; code: string}; id?: string}}) => {
      lookups.push(args.where);
      if (args.where.id === 'user-id') return {id: 'user-id', entity: 'User', code: 'suspended'};
      return args.where.entity_code ? {id: 'directory-id', ...args.where.entity_code} : null;
    }},
  } as unknown as Prisma.TransactionClient;
  return {tx, lookups};
}

test('writes resolve actual directory IDs and preserve partial marketplace transitions', async () => {
  const {tx, lookups} = database({kind: 'auction', ...record('pending')});
  assert.deepEqual(await statusWrite(tx, 'MarketEntry', {moderationStatus: 'visible'}, 'entry'), {statusId: 'directory-id'});
  assert.deepEqual(lookups.at(-1), {entity_code: {entity: 'Auction', code: 'active'}});
  await statusWrite(tx, 'MarketEntry', {status: 'active'}, 'entry');
  assert.deepEqual(lookups.at(-1), {entity_code: {entity: 'Auction', code: 'pending'}});
  await statusWrite(tx, 'MarketEntry', {moderationStatus: 'hidden', kind: 'listing'}, 'entry');
  assert.deepEqual(lookups.at(-1), {entity_code: {entity: 'Listing', code: 'rejected'}});
  await statusWrite(tx, 'Deal', {status: 'completed'});
  assert.deepEqual(lookups.at(-1), {entity_code: {entity: 'Deal', code: 'completed'}});
});

test('sold auctions can reopen, while closing a draft selects the terminal directory code', async () => {
  const {tx, lookups} = database({kind: 'auction', ...record('sold')});
  await statusWrite(tx, 'MarketEntry', {status: 'active'}, 'entry');
  assert.deepEqual(lookups.at(-1), {entity_code: {entity: 'Auction', code: 'active'}});
  const draft = database({kind: 'listing', ...record('draft')});
  await statusWrite(draft.tx, 'MarketEntry', {status: 'closed'}, 'entry');
  assert.deepEqual(draft.lookups.at(-1), {entity_code: {entity: 'Listing', code: 'closed'}});
});

test('admin exposes only statusId and strips reference metadata before persistence', async () => {
  const table = getTable('User');
  assert.ok(table.fields.some(field => field.name === 'statusId' && field.reference === 'Status'));
  assert.ok(!table.fields.some(field => ['status','moderationStatus'].includes(field.name)));
  assert.deepEqual(recordSelect(table).statusReference, {select: {code: true}});
  assert.throws(() => parseData(table, {status: 'suspended'}, false));
  const {tx} = database();
  const data: Record<string, unknown> = {statusId: 'user-id'};
  await resolveStatus(tx, 'User', data);
  assert.deepEqual(data.statusReference, {code: 'suspended'});
  assert.deepEqual(scalarStatusData(data), {statusId: 'user-id'});
  await assert.rejects(resolveStatus(tx, 'Game', {statusId: 'user-id'}));
});

test('missing directory entries fail without inventing status IDs', async () => {
  const tx = {status: {findUnique: async () => null}} as unknown as Prisma.TransactionClient;
  await assert.rejects(statusWrite(tx, 'User', {status: 'active'}), /Статус не найден/);
});
