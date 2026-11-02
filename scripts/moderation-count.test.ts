import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { AppError } from '../server/src/errors.ts';
import { API_MUTATION_EVENT, apiRequest } from '../src/api/client.ts';

test('pending count is restricted to staff and matches the moderation queue', async () => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/discvault_ci';
  const {registerMarketAdminRoutes} = await import('../server/src/market/adminRoutes.ts');
  const app=Fastify();
  let queries=0;
  app.decorate('prisma',{marketEntry:{count:async(args:unknown)=>{assert.deepEqual(args,{where:{deletedAt:null,statusReference:{code:{in:['pending']}}}});queries++;return 7;}}} as any);
  app.decorate('authenticate',async(request:any)=>{request.user=request.headers['x-role']?{id:'user',role:request.headers['x-role']}:null;});
  app.setErrorHandler((error,_request,reply)=>{reply.code(error instanceof AppError?error.statusCode:500).send({message:error.message});});
  registerMarketAdminRoutes(app);
  try {
    for(const role of ['admin','moderator']) {
      const result=await app.inject({method:'GET',url:'/api/v1/admin/market/pending-count',headers:{'x-role':role}});
      assert.equal(result.statusCode,200,result.body);assert.deepEqual(result.json(),{count:7});
    }
    assert.equal((await app.inject({method:'GET',url:'/api/v1/admin/market/pending-count',headers:{'x-role':'user'}})).statusCode,403);
    assert.equal((await app.inject({method:'GET',url:'/api/v1/admin/market/pending-count'})).statusCode,401);
    assert.equal(queries,2);
  } finally {await app.close();}
});

test('successful mutations refresh badges; reads and failed writes do not', async () => {
  const originalFetch=globalThis.fetch;
  const originalWindow=(globalThis as any).window;
  const target=new EventTarget();
  let events=0;
  target.addEventListener(API_MUTATION_EVENT,()=>events++);
  (globalThis as any).window=target;
  try {
    globalThis.fetch=async()=>new Response('{}');
    await apiRequest('/test');assert.equal(events,0);
    await apiRequest('/test',{method:'PATCH',body:{}});assert.equal(events,1);
    globalThis.fetch=async()=>new Response(null,{status:204});
    await apiRequest('/test',{method:'DELETE'});assert.equal(events,2);
    globalThis.fetch=async()=>new Response('{}',{status:403});
    await assert.rejects(apiRequest('/test',{method:'POST'}));assert.equal(events,2);
  } finally {globalThis.fetch=originalFetch;if(originalWindow===undefined)delete (globalThis as any).window;else (globalThis as any).window=originalWindow;}
});
