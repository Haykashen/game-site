import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerShowcaseRoutes, publicCopyShare} from '../server/src/collection/showcase.ts';
import {AppError} from '../server/src/errors.ts';
const row = {id:'share', caption:'Find', photos:['https://example.com/public.jpg'], condition:'9', completeness:'CIB', region:'EUR', createdAt:new Date(), copy:{notes:'SECRET NOTES', purchasePriceMinor:12345,purchaseDate:new Date(),user:{id:'owner',displayName:'Collector',email:'PRIVATE EMAIL'},edition:{id:'edition',name:'Standard',platform:'PS5',game:{id:'game',title:'Test',moderationNote:'PRIVATE'}}}};
test('public copy shares contain no personal copy data or account fields',()=>{
  const dto=publicCopyShare(row as any),text=JSON.stringify(dto);
  assert.ok(!text.includes('SECRET'));assert.ok(!text.includes('PRIVATE'));assert.ok(!('purchasePriceMinor' in dto));assert.ok(!('purchaseDate' in dto));assert.deepEqual(dto.author,{id:'owner',displayName:'Collector'});
});
test('publishing and unpublishing enforce ownership; snapshots ignore later private photos',async()=>{
  const app=Fastify();let stored: any,allowed=false;
  const copy={id:'copy',photos:[{url:'https://example.com/first.jpg'}],condition:'10',completeness:'CIB',region:null,edition:{region:{code:'EUR'}}};
  app.decorate('authenticate',async(request,reply)=>{if(!request.headers['x-owner']){await reply.code(401).send({});return;}request.user={id:'owner'} as any;});
  app.decorate('prisma',{copy:{findFirst:async(args:any)=>{assert.equal(args.where.userId,'owner');return allowed?copy:null;}},copyShare:{upsert:async(args:any)=>{stored=args.create;return {...row,...stored};},deleteMany:async(args:any)=>{assert.equal(args.where.copy.userId,'owner');return {count:allowed?1:0};}}} as any);
  app.setErrorHandler((e,_req,res)=>res.code(e instanceof AppError?e.statusCode:500).send({message:e.message}));registerShowcaseRoutes(app);
  try{
    assert.equal((await app.inject({method:'POST',url:'/api/v1/community/showcase',payload:{copyId:'copy'}})).statusCode,401);
    assert.equal((await app.inject({method:'POST',url:'/api/v1/community/showcase',headers:{'x-owner':'yes'},payload:{copyId:'copy'}})).statusCode,404);
    allowed=true;const response=await app.inject({method:'POST',url:'/api/v1/community/showcase',headers:{'x-owner':'yes'},payload:{copyId:'copy',caption:'My find'}});assert.equal(response.statusCode,201,response.body);assert.deepEqual(stored.photos,['https://example.com/first.jpg']);
    copy.photos.push({url:'https://example.com/private.jpg'});assert.equal(stored.photos.length,1);
    copy.photos=[];assert.equal((await app.inject({method:'POST',url:'/api/v1/community/showcase',headers:{'x-owner':'yes'},payload:{copyId:'copy'}})).statusCode,400);
    allowed=false;assert.equal((await app.inject({method:'DELETE',url:'/api/v1/community/showcase/share',headers:{'x-owner':'yes'}})).statusCode,404);
    allowed=true;assert.equal((await app.inject({method:'DELETE',url:'/api/v1/community/showcase/share',headers:{'x-owner':'yes'}})).statusCode,204);
  }finally{await app.close();}
});
