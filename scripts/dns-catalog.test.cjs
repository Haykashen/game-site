const test = require('node:test');
const assert = require('node:assert/strict');
const { planCatalog, coverImages } = require('./lib/dns-catalog.cjs');
const image = 'https://c.dns-shop.ru/thumb/st1/fit/500/500/resize-id/asset.jpg.webp';
const source = (title='Example', platforms=['PS5']) => ({warnings:[], games:[{id:'game-source',title,genres:['экшн'],productIds:['sku'],platforms:platforms.map(name=>({name,editions:[{id:'sku',name:'Deluxe Edition',platforms,images:[image],releaseDate:'2024-01-02',interfaceLanguages:['русский'],voiceLanguages:['английский'],code:'123'}]}))}]});
test('matches existing title variants without replacing IDs or curated facts',()=>{
  const old={id:'curated',title:'God of War (2018)',coverImage:'',year:2018,publisher:'Sony'};
  const plan=planCatalog(source('God of War'),[old],[]);
  assert.equal(plan.createGames.length,0);
  assert.equal(plan.createEditions[0].gameId,'curated');
  assert.deepEqual(plan.updateGames,[{id:'curated',data:{coverImage:image}}]);
  assert.equal(old.year,2018);
});
test('unknown game facts stay unknown and edition dates stay on editions',()=>{
  const plan=planCatalog(source(),[],[]);
  assert.equal(plan.createGames[0].year,null);
  assert.equal(plan.createGames[0].publisher,'');
  assert.equal(plan.createEditions[0].releaseDate.toISOString(),'2024-01-02T00:00:00.000Z');
  assert.equal(plan.createEditions[0].region,'Не указан');
});
test('one SKU on two platforms has unique edition IDs and the original external product ID',()=>{
  const plan=planCatalog(source('Example',['PS4','PS5']),[],[]);
  assert.deepEqual(plan.createEditions.map(e=>e.id),['sku-ps4','sku-ps5']);
  assert.deepEqual(plan.createEditions.map(e=>e.dnsProductId),['sku','sku']);
});
test('repeat import produces no writes and linked editions preserve their ID',()=>{
  const plan=planCatalog(source(),[],[]);
  const repeated=planCatalog(source(),plan.createGames,plan.createEditions);
  assert.equal(repeated.createGames.length+repeated.createEditions.length+repeated.updateGames.length+repeated.updateEditions.length,0);
  const linked=planCatalog(source(),plan.createGames,[{...plan.createEditions[0],id:'linked-edition'}]);
  assert.equal(linked.createEditions.length,0);
});
test('cover variants collapse by asset, selecting the best saved resolution',()=>{
  assert.deepEqual(coverImages([image.replace('/500/500/','/200/200/').replace('.webp',''),image]),[image]);
  assert.throws(()=>coverImages(['https://other.invalid/cover.jpg']),/Unexpected cover URL/);
});
test('ambiguous existing titles and identity collisions abort without guessing',()=>{
  assert.throws(()=>planCatalog(source(),[{id:'a',title:'Example'},{id:'b',title:'EXAMPLE'}],[]),/Ambiguous/);
  assert.throws(()=>planCatalog(source(),[{id:'game-source',title:'Another game'}],[]),/collision/);
});
test('Xbox digital add-ons use stable edition IDs per generation and an explicit media type',()=>{
  const document=source('Example',['Xbox One','Xbox Series S','Xbox Series X']);
  for(const p of document.games[0].platforms)Object.assign(p.editions[0],{editionType:'цифровое издание',contentType:'addon',name:'Дополнение: Pack'});
  const plan=planCatalog(document,[],[]);
  assert.deepEqual(plan.createEditions.map(e=>e.id),['sku-xbox-one','sku-xbox-series-s','sku-xbox-series-x']);
  assert.ok(plan.createEditions.every(e=>e.media==='Цифровое издание'&&e.description.startsWith('Дополнение к игре.')));
});
