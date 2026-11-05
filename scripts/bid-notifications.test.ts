import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { notifyNewBid } from '../server/src/notifications/events.js';

test('new bid notifies author, all earlier bidders and followers once, excluding actor', async () => {
  let rows: any[] = [];
  const db = {
    marketEntrySubscription: { findMany: async () => [{ userId: 'older' }, { userId: 'follower' }, { userId: 'actor' }, { userId: 'leader' }] },
    bid: { findMany: async (query: any) => {
      assert.deepEqual(query.where, { marketEntryId: 'lot' });
      assert.deepEqual(query.distinct, ['bidderId']);
      return ['older', 'leader', 'actor'].map(bidderId => ({ bidderId }));
    } },
    notification: { createMany: async (input: any) => { rows = input.data; } },
  } as unknown as PrismaClient;
  await notifyNewBid(db, { entryId: 'lot', entryTitle: 'Lot', gameId: 'game', authorId: 'seller', bidId: 'bid', bidder: { id: 'actor', displayName: 'Actor' }, amountMinor: 10000, previousBidderId: 'leader' });
  assert.deepEqual(rows.map(row => row.userId).sort(), ['follower', 'leader', 'older', 'seller']);
  assert.equal(rows.find(row => row.userId === 'leader').type, 'bid_outbid');
  assert.equal(new Set(rows.map(row => row.dedupeKey)).size, rows.length);
});