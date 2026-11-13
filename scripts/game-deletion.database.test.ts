import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import Fastify from 'fastify';
import {PrismaClient} from '@prisma/client';
import {registerAdminDataRoutes} from '../server/src/admin/routes.ts';
import {AppError} from '../server/src/errors.ts';
const allowed = (process.env.CI === 'true' && (process.env.DATABASE_URL ?? '').includes('/discvault_ci')) ||
  (process.env.GAME_DELETE_LOCAL_TESTS === 'true' && (process.env.DATABASE_URL ?? '').includes('localhost:51218/'));

test('game deletion removes its editions and variants atomically, protecting collections and other games', {skip: !allowed}, async () => {
  const prisma = new PrismaClient();
  const app = Fastify({routerOptions:{maxParamLength:2000}});
  const id = 'delete-test-' + randomUUID();
  const otherId = id + '-other';
  const userId = randomUUID();
  const regionId = randomUUID();
  app.decorate('prisma',prisma);
  app.decorateRequest('user',null);
  app.decorate('authenticate',async request => {request.user = {id:userId,email:'delete@test.local',displayName:'Test admin',role:'admin',status:'active',isDemo:false};});
  app.setErrorHandler((error,_request,reply)=>reply.code(error instanceof AppError ? error.statusCode : 500).send({error:{message:error.message}}));
  registerAdminDataRoutes(app);
  const url = '/api/v1/admin/data/Game/records/' + encodeURIComponent(JSON.stringify({id}));
  try {
    await prisma.user.create({data:{id:userId,email:randomUUID()+'@test.local',displayName:'Deletion test'}});
    await prisma.region.create({data:{id:regionId,code:id,name:id}});
    const game = await prisma.game.create({data:{id,title:id,publisher:'',description:''}});
    await prisma.game.create({data:{id:otherId,title:otherId,publisher:'',description:''}});
    const edition = await prisma.edition.create({data:{id:randomUUID(),gameId:id,name:'Standard',platform:'PS5',regionId,media:'Disc'}});
    const variant = await prisma.edition.create({data:{id:randomUUID(),gameId:id,name:'Variant',platform:'PS5',regionId,media:'Disc'}});
    await prisma.edition.create({data:{id:randomUUID(),gameId:otherId,name:'Other',platform:'PS5',regionId,media:'Disc'}});
    await prisma.copy.create({data:{userId,editionId:edition.id}});
    const payload = {expectedUpdatedAt:game.updatedAt.toISOString()};
    const preview = await app.inject({method:'GET',url:url+'/dependencies'});
    assert.equal(preview.statusCode,200,preview.body);
    assert.equal(preview.json().autoDeleteEditions,2);
    assert.match(preview.json().dependencies.join(';'),/Экземпляры в коллекциях: 1/);
    const blocked = await app.inject({method:'DELETE',url,payload});
    assert.equal(blocked.statusCode,409,blocked.body);
    assert.equal(await prisma.edition.count({where:{gameId:id}}),2);
    await prisma.copy.deleteMany({where:{userId}});
    const entry = await prisma.marketEntry.create({data:{authorId:userId,gameId:id,editionId:edition.id,kind:'listing',listingType:'sale',title:'Test',description:'',condition:'New',priceMinor:100,shipsFrom:'Москва',deliveryServices:[]}});
    assert.equal((await app.inject({method:'DELETE',url,payload})).statusCode,409);
    assert.equal(await prisma.edition.count({where:{gameId:id}}),2);
    await prisma.marketEntry.delete({where:{id:entry.id}});
    const clear = await app.inject({method:'GET',url:url+'/dependencies'});
    assert.deepEqual(clear.json().dependencies,[]);
    assert.equal(clear.json().autoDeleteEditions,2);
    assert.equal((await app.inject({method:'DELETE',url,payload:{expectedUpdatedAt:new Date(0).toISOString()}})).statusCode,409);
    const removed = await app.inject({method:'DELETE',url,payload});
    assert.equal(removed.statusCode,204,removed.body);
    assert.equal(await prisma.game.count({where:{id}}),0);
    assert.equal(await prisma.edition.count({where:{gameId:id}}),0);
    assert.equal(await prisma.edition.count({where:{gameId:otherId}}),1);
    assert.equal((await app.inject({method:'DELETE',url,payload})).statusCode,404);
  } finally {
    await prisma.copy.deleteMany({where:{userId}});
    await prisma.marketEntry.deleteMany({where:{authorId:userId}});
    await prisma.game.deleteMany({where:{id:{in:[id,otherId]}}});
    await prisma.region.deleteMany({where:{id:regionId}});
    await prisma.user.deleteMany({where:{id:userId}});
    await app.close(); await prisma.$disconnect();
  }
});
