import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import type {PrismaClient} from '@prisma/client';
import { AppError } from '../server/src/errors.ts';
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost/test';
const {registerRecognitionRoutes, recognitionPlatform} = await import('../server/src/recognition/routes.ts');
const {publicIPv4, recognitionImage} = await import('../server/src/recognition/image.ts');

test('image input blocks local networks, credentials, redirects and non-images', async()=>{
  for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.1.1','100.64.0.1','::1']) assert.equal(publicIPv4(ip),false,ip);
  assert.equal(publicIPv4('8.8.8.8'),true);
  for(const source of ['http://example.com/a.jpg','https://user:password@example.com/a.jpg','data:image/png;base64,SGVsbG8=']) await assert.rejects(()=>recognitionImage(source));
  assert.equal(recognitionPlatform('PlayStation 5'),'PS5');
  assert.equal(recognitionPlatform('Imaginary console'),null);
});

test('recognition handles missing key, model failures, matching and signed confirmation', async()=>{
  const oldKey=process.env.GEMINI_API_KEY;const oldFetch=globalThis.fetch;
  const app=Fastify();
  let writes=0;
  const game={id:'game',title:'Frostpunk',publisher:'',developer:'',series:'',year:null,genres:[],description:'',coverImage:''};
  const edition={id:'edition',gameId:'game',name:'Console Edition',platform:'Xbox One',region:{code:'EUR'},lang:'Русский',media:'Disc',releaseDate:null,description:'',contents:[],coverImages:[],barcode:'',dnsProductId:'',dnsProductCode:''};
  let createdPending = false;
  const tx={region:{findFirst:async()=>({id:'region',code:'EUR'}),findUniqueOrThrow:async()=>({id:'region',code:'EUR'})},game:{findMany:async()=>[game],create:async({data}:{data:Record<string,unknown>})=>{createdPending=data.recognitionPending===true;return game;}},edition:{findFirst:async():Promise<typeof edition|null>=>edition,create:async({data}:{data:Record<string,unknown>})=>{assert.equal(data.recognitionPending,true);return edition;}},$executeRaw:async()=>0};
  app.decorate('prisma',{game:{findMany:async()=>[{...game,editions:[edition]}]},$transaction:async(action:(value:unknown)=>unknown)=>{writes++;return action(tx);}} as unknown as PrismaClient);
  app.decorateRequest('user',null);
  app.decorate('authenticate',async request=>{request.user={id:'user',email:'test@example.com',displayName:'Test',role:'user',status:'active',isDemo:false};});
  app.setErrorHandler((error,_request,reply)=>reply.code(error instanceof AppError?error.statusCode:500).send({error:error.message}));
  registerRecognitionRoutes(app);
  const url='/api/v1/recognition/game';const payload={source:'data:image/png;base64,iVBORw0KGgo='};
  try {
    delete process.env.GEMINI_API_KEY;
    assert.equal((await app.inject({method:'POST',url,payload})).statusCode,503);
    process.env.GEMINI_API_KEY='test-only';
    globalThis.fetch=async()=>new Response('unavailable',{status:429});
    assert.equal((await app.inject({method:'POST',url,payload})).statusCode,502);
    const facts={title:'Frostpunk',platform:'Xbox One',edition:'Console Edition',region:'EUR',language:'Русский',barcode:'',identified:true};
    globalThis.fetch=async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify(facts)}]}}]});
    const result=await app.inject({method:'POST',url,payload});assert.equal(result.statusCode,200,result.body);assert.equal(result.json().matches[0].edition.id,'edition');assert.equal(writes,0);
    const invalid=await app.inject({method:'POST',url:url+'/confirm',payload:{token:result.json().token+'tampered'}});assert.equal(invalid.statusCode,400);assert.equal(writes,0);
    const confirm=await app.inject({method:'POST',url:url+'/confirm',payload:{token:result.json().token}});assert.equal(confirm.statusCode,200,confirm.body);assert.equal(confirm.json().game.id,'game');assert.equal(writes,1);
    game.title='Vampire: The Masquerade - Coteries of New York + Shadows of New York';edition.platform='PS4';edition.name='Standard';
    Object.assign(facts,{title:game.title,platform:'PS4',edition:'',region:'',language:''});
    const compilation=await app.inject({method:'POST',url,payload});assert.equal(compilation.statusCode,200,compilation.body);assert.equal(compilation.json().matches.length,1);
    tx.game.findMany=async()=>[];tx.edition.findFirst=async()=>null;
    const created=await app.inject({method:'POST',url:url+'/confirm',payload:{token:result.json().token}});assert.equal(created.statusCode,200,created.body);assert.equal(createdPending,true);
  } finally {globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;await app.close();}
});