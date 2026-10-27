import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import { registerAdminDataRoutes } from '../server/src/admin/routes.ts';
import { registerUserAdminRoutes } from '../server/src/users/adminRoutes.ts';
import { AppError } from '../server/src/errors.ts';
import { touchPresence } from '../server/src/auth/presence.ts';

const isolated = process.env.CI === 'true' && (process.env.DATABASE_URL ?? '').includes('/discvault_ci');
test('administrator CRUD persists to PostgreSQL for every model and preserves business aggregates', {skip: !isolated ? 'Requires the isolated CI database discvault_ci.' : false}, async () => {
  const prisma = new PrismaClient();
  const app = Fastify({routerOptions: {maxParamLength: 2000}});
  const suffix = randomUUID();
  const adminId = randomUUID();
  let sellerId = '';
  let buyerId = '';
  app.decorate('prisma', prisma);
  app.decorateRequest('user', null);
  app.decorate('authenticate', async (request) => {request.user = {id: adminId, email: suffix + '@test.invalid', displayName: 'CI admin', role: 'admin', status: 'active', isDemo: false};});
  app.setErrorHandler((error, _request, reply) => reply.code(error instanceof AppError ? error.statusCode : 500).send({error: {message: error.message}}));
  registerAdminDataRoutes(app);
  registerUserAdminRoutes(app);
  const path = (model: string, key?: Record<string, string>) => '/api/v1/admin/data/' + model + '/records' + (key ? '/' + encodeURIComponent(JSON.stringify(key)) : '');
  const created: {model: string; key: Record<string, string>}[] = [];
  async function create(model: string, data: Record<string, unknown>, keyFields = ['id']) {
    const response = await app.inject({method: 'POST', url: path(model), payload: data});
    assert.equal(response.statusCode, 201, model + ': ' + response.body);
    const row = response.json().record;
    const key = Object.fromEntries(keyFields.map((field) => [field, row[field]]));
    created.push({model, key});
    assert.ok(!response.body.includes('passwordHash'));
    const read = await app.inject({method: 'GET', url: path(model, key)});
    assert.equal(read.statusCode, 200, read.body);
    return row;
  }
  async function patch(model: string, key: Record<string, string>, data: Record<string, unknown>) {
    const current = await app.inject({method: 'GET', url: path(model, key)});
    const response = await app.inject({method: 'PATCH', url: path(model, key), payload: {data, expectedUpdatedAt: current.json().record.updatedAt ?? null}});
    assert.equal(response.statusCode, 200, model + ': ' + response.body);
    return response.json().record;
  }
  try {
    await prisma.user.create({data: {id: adminId, email: 'admin-' + suffix + '@test.invalid', displayName: 'CI admin', role: 'admin'}});
    sellerId = (await create('User', {email: 'seller-' + suffix + '@test.invalid', displayName: 'Seller', password: 'ci-test-password'})).id;
    buyerId = (await create('User', {email: 'buyer-' + suffix + '@test.invalid', displayName: 'Buyer', password: 'ci-test-password'})).id;
    await patch('User', {id: buyerId}, {city: 'Москва', comment: 'Admin note'});
    const gameId = (await create('Game', {title: 'Admin fixture ' + suffix, publisher: 'CI', description: 'Fixture', genres: ['RPG']})).id;
    const editionId = (await create('Edition', {gameId, name: 'Standard', platform: 'PS5', region: 'RU', lang: 'Русский', media: 'Disc', contents: [], coverImages: [], releaseDate: '2026-01-02T00:00:00.000Z'})).id;
    await create('GameRating', {userId: buyerId, gameId, score: 8}, ['userId', 'gameId']);
    await patch('GameRating', {userId: buyerId, gameId}, {score: 9});
    const copy = await create('Copy', {userId: buyerId, editionId, purchasePriceMinor: 12345});
    await create('CopyPhoto', {copyId: copy.id, url: 'https://example.com/copy.jpg'});
    const listing = await create('MarketEntry', {authorId: sellerId, kind: 'listing', listingType: 'sale', gameId, editionId, title: 'CI listing', condition: 'New', priceMinor: 10000, description: 'CI', deliveryServices: ['cdek'], shipsFrom: 'Москва'});
    await create('MarketPhoto', {entryId: listing.id, url: 'https://example.com/market.jpg'});
    const auction = await create('MarketEntry', {authorId: sellerId, kind: 'auction', gameId, editionId, title: 'CI auction', condition: 'New', priceMinor: 10000, bidStepMinor: 1000, endsAt: '2099-01-01T00:00:00.000Z', description: 'CI', deliveryServices: ['russian_post'], shipsFrom: 'Москва'});
    const bid = await create('Bid', {marketEntryId: auction.id, bidderId: buyerId, amountMinor: 12000});
    await patch('Bid', {id: bid.id}, {amountMinor: 14000});
    const auctionAfter = await prisma.marketEntry.findUniqueOrThrow({where: {id: auction.id}});
    assert.equal(auctionAfter.bidCount, 1); assert.equal(auctionAfter.currentPriceMinor, 14000);
    const deal = await create('Deal', {marketEntryId: listing.id, sellerId, buyerId, amountMinor: 10000, status: 'completed'});
    assert.equal((await prisma.marketEntry.findUniqueOrThrow({where: {id: listing.id}})).status, 'sold');
    const review = await create('Review', {dealId: deal.id, authorId: buyerId, targetId: sellerId, rating: 5, text: 'Great'});
    await patch('Review', {id: review.id}, {rating: 4});
    const seller = await prisma.user.findUniqueOrThrow({where: {id: sellerId}});
    assert.equal(seller.ratingSum, 4); assert.equal(seller.ratingCount, 1);
    await create('Report', {reporterId: buyerId, targetType: 'market_entry', targetId: listing.id, marketEntryId: listing.id, reason: 'other'});
    await create('Notification', {userId: buyerId, type: 'entry_created', title: 'CI', message: 'CI', gameId});
    await create('GameSubscription', {userId: buyerId, gameId});
    await create('MarketEntrySubscription', {userId: buyerId, marketEntryId: listing.id});
    const discussion = await create('Discussion', {gameId, authorId: buyerId, title: 'CI thread', excerpt: 'CI', body: 'CI', tags: []});
    const comment = await create('DiscussionComment', {discussionId: discussion.id, authorId: sellerId, body: 'CI comment'});
    await patch('DiscussionComment', {id: comment.id}, {body: 'Edited comment'});
    await create('NewsPost', {authorId: sellerId, gameId, title: 'CI news', excerpt: 'CI', body: 'CI', category: 'community', tags: []});
    const session = await prisma.session.create({data: {userId: buyerId, tokenHash: createHash('sha256').update(suffix).digest('hex'), expiresAt: new Date('2099-01-01')}});
    created.push({model: 'Session', key: {id: session.id}});
    const presenceTime = new Date();
    const profileVersion = (await prisma.user.findUniqueOrThrow({where: {id: buyerId}})).updatedAt;
    await prisma.session.update({where: {id: session.id}, data: {lastUsedAt: new Date(presenceTime.getTime() - 70000)}});
    await touchPresence(prisma, session.id, buyerId, presenceTime);
    const presentBuyer = await prisma.user.findUniqueOrThrow({where: {id: buyerId}});
    assert.equal(presentBuyer.lastSeenAt?.toISOString(), presenceTime.toISOString());
    assert.equal(presentBuyer.updatedAt.toISOString(), profileVersion.toISOString());
    const online = await app.inject({method: 'GET', url: '/api/v1/admin/users?online=online&id=' + buyerId});
    assert.equal(online.statusCode, 200, online.body);
    assert.equal(online.json().items[0].isOnline, true);
    const related = await app.inject({method: 'GET', url: path('Deal') + '?relatedUserId=' + buyerId});
    assert.equal(related.statusCode, 200, related.body);
    assert.equal(related.json().items[0].id, deal.id);
    assert.equal(related.json().total, 1);
    const unrelated = await app.inject({method: 'GET', url: path('Deal') + '?relatedUserId=' + adminId});
    assert.equal(unrelated.json().total, 0);
    const users = await app.inject({method: 'GET', url: '/api/v1/admin/users?id=' + buyerId + '&copies=1'});
    assert.equal(users.statusCode, 200, users.body);
    assert.equal(users.json().items[0].copies, 1);
    const gameFilter = await app.inject({method: 'GET', url: path('Game') + '?search=' + suffix + '&filters=' + encodeURIComponent(JSON.stringify({genres: 'RPG'}))});
    assert.equal(gameFilter.statusCode, 200, gameFilter.body);
    assert.equal(gameFilter.json().items[0].id, gameId);
    const blocked = await app.inject({method: 'DELETE', url: path('Game', {id: gameId}), payload: {expectedUpdatedAt: (await prisma.game.findUniqueOrThrow({where: {id: gameId}})).updatedAt.toISOString()}});
    assert.equal(blocked.statusCode, 409, blocked.body);
    for (const item of [...created].reverse()) {
      const current = await app.inject({method: 'GET', url: path(item.model, item.key)});
      assert.equal(current.statusCode, 200, current.body);
      const response = await app.inject({method: 'DELETE', url: path(item.model, item.key), payload: {expectedUpdatedAt: current.json().record.updatedAt ?? null}});
      assert.equal(response.statusCode, 204, item.model + ': ' + response.body);
      if (item.model === 'Session') assert.equal((await prisma.user.findUniqueOrThrow({where: {id: buyerId}})).lastSeenAt?.toISOString(), presenceTime.toISOString());
    }
    assert.equal((await prisma.user.findUniqueOrThrow({where: {id: adminId}})).role, 'admin');
  } finally {
    // Fixture-scoped cleanup also runs if an assertion failed halfway through.
    const userIds = [adminId, ...created.filter((item) => item.model === 'User').map((item) => item.key.id!)];
    await prisma.report.deleteMany({where: {reporterId: {in: userIds}}});
    await prisma.newsPost.deleteMany({where: {authorId: {in: userIds}}});
    await prisma.discussion.deleteMany({where: {authorId: {in: userIds}}});
    await prisma.review.deleteMany({where: {authorId: {in: userIds}}});
    await prisma.marketEntry.deleteMany({where: {authorId: {in: userIds}}});
    await prisma.user.deleteMany({where: {id: {in: userIds}}});
    await prisma.game.deleteMany({where: {id: {in: created.filter((item) => item.model === 'Game').map((item) => item.key.id!)}}});
    await app.close(); await prisma.$disconnect();
  }
});
