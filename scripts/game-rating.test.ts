import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import type { PrismaClient } from '@prisma/client';
import { registerGameRatingRoutes } from '../server/src/catalog/ratings.ts';
import { AppError } from '../server/src/errors.ts';

test('zero is a saved score, contributes to the average, and differs from a deleted rating', async () => {
  let score: number | null = null;
  const db = {
    game: {findUnique: async () => ({id: 'game'})},
    gameRating: {
      upsert: async ({create}: {create: {score: number}}) => {score = create.score;},
      findUnique: async () => score === null ? null : {score},
      aggregate: async () => ({_avg: {score}, _count: {score: score === null ? 0 : 1}}),
      deleteMany: async () => {score = null;},
    },
    $transaction: async (action: (tx: unknown) => unknown) => action(db),
  };
  const app = Fastify();
  app.decorate('prisma', db as unknown as PrismaClient);
  app.decorateRequest('user', null);
  const authenticate = async (request: import('fastify').FastifyRequest) => {request.user = {id: 'user', email: 'test@example.com', displayName: 'Test', role: 'user', status: 'active', isDemo: false};};
  app.decorate('authenticate', authenticate);
  app.decorate('optionalAuth', authenticate);
  app.setErrorHandler((error, _request, reply) => reply.code(error instanceof AppError ? error.statusCode : 500).send({error: error.message}));
  registerGameRatingRoutes(app);
  try {
    const path = '/api/v1/catalog/games/game/ratings';
    for (const value of [0, 10]) {
      const response = await app.inject({method: 'PUT', url: path, payload: {score: value}});
      assert.equal(response.statusCode, 200, response.body);
      assert.deepEqual(response.json(), {average: value, count: 1, myScore: value});
    }
    for (const value of [-1, 11, 1.5]) assert.equal((await app.inject({method: 'PUT', url: path, payload: {score: value}})).statusCode, 400);
    const removed = await app.inject({method: 'DELETE', url: path});
    assert.deepEqual(removed.json(), {average: null, count: 0, myScore: null});
  } finally {await app.close();}
});
test('market data follows the selected release, including its language variants', async () => {
  const {gameEditionEntries} = await import('../src/lib/gameMarket.ts');
  type Entry = import('../src/types.ts').MarketEntry;
  type Edition = import('../src/types.ts').Edition;
  const entries = [
    {id: 'selected', gameId: 'game', editionId: 'ps5'},
    {id: 'variant', gameId: 'game', editionId: 'ps5-ru'},
    {id: 'other-platform', gameId: 'game', editionId: 'ps4'},
    {id: 'hidden', gameId: 'game', editionId: 'ps5', moderationStatus: 'hidden'},
    {id: 'other-game', gameId: 'other', editionId: 'ps5'},
    {id: 'unbound', gameId: 'game', editionId: null},
  ] as Entry[];
  assert.deepEqual(gameEditionEntries(entries, 'game', {id: 'ps5', variants: [{id: 'ps5-ru'}]} as Edition).map(entry => entry.id), ['selected', 'variant']);
  assert.deepEqual(gameEditionEntries(entries, 'game', {id: 'ps4'} as Edition).map(entry => entry.id), ['other-platform']);
});