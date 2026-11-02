import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { AppError } from '../server/src/errors.ts';
import { isActiveAuction } from '../shared/src/marketLifecycle.ts';

test('only a published active auction is locked, including one without bids', () => {
  assert.equal(isActiveAuction({kind: 'auction', status: 'active', moderationStatus: 'visible'}), true);
  for (const moderationStatus of ['draft', 'pending', 'hidden']) assert.equal(isActiveAuction({kind: 'auction', status: 'active', moderationStatus}), false);
  assert.equal(isActiveAuction({kind: 'listing', status: 'active', moderationStatus: 'visible'}), false);
  assert.equal(isActiveAuction({kind: 'auction', status: 'closed', moderationStatus: 'visible'}), false);
});

test('direct HTTP edit of an active auction is rejected before writing', async () => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/discvault_ci';
  const {registerMarketRoutes} = await import('../server/src/market/routes.ts');
  const app = Fastify();
  app.decorate('prisma', {marketEntry: {findFirst: async () => ({id: 'lot', authorId: 'owner', kind: 'auction', status: 'active', moderationStatus: 'visible', bidCount: 0, photos: []})}} as any);
  const authenticate = async (request: any) => {request.user = {id: 'owner'};};
  app.decorate('authenticate', authenticate);
  app.decorate('optionalAuth', authenticate);
  app.setErrorHandler((error, _request, reply) => {reply.code(error instanceof AppError ? error.statusCode : 500).send({message: error.message, code: error instanceof AppError ? error.code : ''});});
  registerMarketRoutes(app);
  try {
    const result = await app.inject({method: 'PATCH', url: '/api/v1/market/lot', payload: {title: 'Changed title'}});
    assert.equal(result.statusCode, 409, result.body);
    assert.equal(result.json().code, 'ACTIVE_AUCTION_LOCKED');
    assert.match(result.json().message, /Создайте новый/);
  } finally {await app.close();}
});
