import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerCollectionRoutes } from '../server/src/collection/routes.ts';
import { fetchCollectionCatalog } from '../src/api/collection.ts';

test('collection catalog needs a session and scopes its lookup to owned canonical editions', async () => {
  const app = Fastify();
  const owner = '11111111-1111-4111-8111-111111111111';
  let requests = 0;
  app.decorate('authenticate', async (request, reply) => {
    if (!request.headers['x-test-user']) {await reply.code(401).send({});return;}
    request.user = {id: owner} as any;
  });
  app.decorate('prisma', {edition: {findMany: async (args: any) => {
    requests++;
    assert.deepEqual(args.where, {canonicalId: null, OR: [{copies: {some: {userId: owner}}}, {variants: {some: {copies: {some: {userId: owner}}}}}]});
    const game = {id: 'owned-game', statusReference: {code: 'visible'}, statusId: 'game-status', title: 'Owned', publisher: '', developer: '', series: null, year: null, genres: [], description: '', coverImage: ''};
    return ['first', 'second'].map(id => ({id, gameId: game.id, game, statusReference: {code: 'visible'}, statusId: 'edition-status', region: {code: 'EUR'}, variants: [], name: id, platform: 'PS5', lang: 'Русский', media: 'Disc', releaseDate: null, description: '', contents: [], coverImages: [], barcode: '', dnsProductId: '', dnsProductCode: ''}));
  }}} as any);
  registerCollectionRoutes(app);
  try {
    assert.equal((await app.inject({method: 'GET', url: '/api/v1/collection/catalog'})).statusCode, 401);
    assert.equal(requests, 0);
    const result = await app.inject({method: 'GET', url: '/api/v1/collection/catalog', headers: {'x-test-user': 'yes'}});
    assert.equal(result.statusCode, 200, result.body);
    assert.equal(result.json().games.length, 1);
    assert.equal(result.json().editions.length, 2);
    assert.equal(requests, 1);
  } finally {await app.close();}
});
test('collection lookup fetches one bounded payload instead of draining catalog pages', async () => {
  const old = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async input => {urls.push(String(input));return Response.json({games: [], editions: []});};
  try {
    assert.deepEqual(await fetchCollectionCatalog(new AbortController().signal), {games: [], editions: []});
    assert.deepEqual(urls, ['/api/v1/collection/catalog']);
  } finally {globalThis.fetch = old;}
});
