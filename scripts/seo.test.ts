import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { pageMetadata, publicImage, registerSeoRoutes, renderMetadata } from '../server/src/seo.ts';
const origin='https://new.example';
test('metadata uses configured origin and safely escapes HTML and JSON-LD',async()=>{
 const meta=await pageMetadata({} as any,'/games',origin);
 meta.title='</title><script>evil</script>';meta.jsonLd={text:'</script><script>evil'};
 const html=renderMetadata('<html><head><title>old</title></head></html>',meta);
 assert.ok(!html.includes('<script>evil'));
 assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(html.includes('\\u003c/script>'));
 assert.ok(html.includes('https://new.example/games'));
 assert.equal(publicImage('javascript:alert(1)',origin),origin+'/og-default.png');
 assert.equal(publicImage('https://old.example/uploads/picture.jpg',origin),origin+'/uploads/picture.jpg');
});
test('public game metadata and unavailable records respect visibility',async()=>{
 let available=true;
 const app={prisma:{game:{findFirst:async(args:any)=>{assert.ok(args.where.statusReference);return available?{title:'Test game',description:'Description',coverImage:'/uploads/game.jpg',developer:'Studio',publisher:'Publisher',genres:[{name:'RPG'}],editions:[{platform:'PS5',coverImages:[]}]}:null;}}}} as any;
 const meta=await pageMetadata(app,'/games?game=game-id&q=ignored',origin);
 assert.equal(meta.jsonLd['@type'],'VideoGame');assert.equal(meta.url,origin+'/games?game=game-id');
 available=false;assert.equal((await pageMetadata(app,'/games?game=missing',origin)).status,404);
 assert.equal((await pageMetadata(app,'/collection',origin)).robots,'noindex,nofollow');
});
test('anonymous requests receive metadata in initial HTML with no private data',async()=>{
 const app=Fastify();app.decorate('prisma',{copyShare:{findFirst:async(args:any)=>{
 assert.ok(args.where.copy.user.statusReference);
 return {topic:'Find',caption:'Public text',photos:['/uploads/share.jpg'],createdAt:new Date('2026-01-01'),copy:{user:{displayName:'Collector'},edition:{game:{title:'Game'}}}};
 }}});
 registerSeoRoutes(app,'<html><head><title>DiscVault</title></head><body><div id="root"></div></body></html>');
 try {
 const path='/community/showcase?post=11111111-1111-4111-8111-111111111111';
 const response=await app.inject({url:path});assert.equal(response.statusCode,200,response.body);
 assert.ok(response.body.includes('property="og:title" content="Find — DiscVault"'));
 assert.ok(response.body.includes('SocialMediaPosting'));
 const endpoint=await app.inject({url:'/api/v1/seo?path='+encodeURIComponent(path)});
 assert.equal(endpoint.statusCode,200);assert.equal(endpoint.json().jsonLd.author.name,'Collector');
 } finally {await app.close();}
});
test('market metadata uses only published records and fixed-price sale offers',async()=>{
 let kind='listing';
 const app={prisma:{marketEntry:{findFirst:async(args:any)=>{
 assert.equal(args.where.deletedAt,null);assert.ok(args.where.statusReference);assert.ok(args.where.author.statusReference);
 return {title:'Sale',description:'Public description',kind,listingType:'sale',priceMinor:12500,photos:[{url:'/uploads/sale.jpg'}]};
 }}}} as any;
 const sale=await pageMetadata(app,'/listings?item=item-id',origin);
 assert.equal(sale.url,origin+'/listings/sales?item=item-id');
 assert.equal((sale.jsonLd.mainEntity as any).offers.price,'125.00');
 kind='auction';const auction=await pageMetadata(app,'/auctions?item=item-id',origin);
 assert.equal((auction.jsonLd.mainEntity as any).offers,undefined);
});
