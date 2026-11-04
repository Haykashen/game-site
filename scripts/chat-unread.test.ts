import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { registerChatRoutes } from '../server/src/chats/routes.ts';

test('chat badge endpoint requires a session and scopes unread counts to its member', async () => {
  const app = Fastify();
  const me = '11111111-1111-4111-8111-111111111111';
  let calls = 0;
  app.decorate('authenticate', async (request, reply) => {
    if (!request.headers['x-user']) {await reply.code(401).send({message: 'Login required'}); return;}
    request.user = {id: me} as any;
  });
  app.decorate('prisma', {$queryRaw: async (sql: TemplateStringsArray, ...values: unknown[]) => {
    calls++;
    assert.deepEqual(values, [me, me]);
    const query = sql.join('?');
    assert.match(query, /membership.user_id =/);
    assert.match(query, /message.author_id <>/);
    assert.match(query, /message.created_at > membership.read_at/);
    assert.match(query, /membership.chat_id = message.chat_id/);
    return [{count: 3}];
  }} as any);
  registerChatRoutes(app);
  try {
    assert.equal((await app.inject({method: 'GET', url: '/api/v1/chats/unread-count'})).statusCode, 401);
    assert.equal(calls, 0);
    const response = await app.inject({method: 'GET', url: '/api/v1/chats/unread-count', headers: {'x-user': 'yes'}});
    assert.equal(response.statusCode, 200, response.body);
    assert.deepEqual(response.json(), {count: 3});
    assert.equal(calls, 1);
  } finally {await app.close();}
});
