import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { applyModeration } from '../server/src/lib/moderation.ts';
import { registerCommunitySubmit } from '../server/src/lib/community-moderation.ts';
import { marketCreateSchema } from '../shared/src/market.ts';

test('review records the reviewer and requires an actionable rejection reason', () => {
  const rejected = {statusReference: {code: 'hidden'}};
  assert.throws(() => applyModeration('Game', rejected, {statusReference: {code: 'pending'}}, 'reviewer'));
  const approved: Record<string, unknown> = {statusReference: {code: 'visible'}};
  applyModeration('Game', approved, {statusReference: {code: 'draft'}}, 'reviewer');
  assert.equal(approved.moderatorId, 'reviewer');
  assert.ok(approved.moderatedAt instanceof Date);
  const resubmitted: Record<string, unknown> = {statusReference: {code: 'pending'}};
  applyModeration('Game', resubmitted, {statusReference: {code: 'hidden'}, moderationNote: 'Wrong release'}, 'reviewer');
  assert.equal(resubmitted.moderatorId, null);
  assert.equal(resubmitted.moderationNote, null);
});

test('owners can submit only their drafts and rejected community records', async () => {
  for (const kind of ['news', 'discussions'] as const) {
    const app = Fastify();
    let calls = 0;
    const db = {updateMany: async (args: any) => {
      calls++;
      assert.equal(args.where.authorId, 'owner');
      assert.deepEqual(args.where.statusReference.code.in, ['draft', 'hidden']);
      assert.equal(args.data.statusId, 'pending-id');
      assert.equal('moderationStatus' in args.data, false);
      return {count: 1};
    }};
    app.decorate('prisma', {newsPost: db, discussion: db, status: {findUnique: async () => ({id: 'pending-id'})}} as any);
    app.decorate('authenticate', async (request: any) => {request.user = {id: 'owner'};});
    registerCommunitySubmit(app, kind);
    try {
      const result = await app.inject({method: 'POST', url: '/api/v1/' + kind + '/draft/submit'});
      assert.equal(result.statusCode, 200, result.body);
      assert.equal(calls, 1);
    } finally {await app.close();}
  }
});

test('public submission cannot request approval or another internal moderation state', () => {
  const base = {kind: 'listing', itemType: 'figure', listingType: 'sale', gameId: 'game', title: 'Figure', condition: 'New', price: 100, description: 'A figure', deliveryServices: ['cdek'], shipsFrom: 'Moscow'};
  assert.equal(marketCreateSchema.parse({...base, submissionStatus: 'draft'}).submissionStatus, 'draft');
  assert.equal(marketCreateSchema.safeParse({...base, submissionStatus: 'visible'}).success, false);
});
