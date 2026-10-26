const test=require('node:test');
const assert=require('node:assert/strict');
const {planCatalog,coverImages}=require('./lib/dns-catalog.cjs');
const {deduplicateDocument,expandProducts}=require('./lib/edition-dedup.cjs');
const {mergeShowgames}=require('./merge-showgames-catalog.cjs');
const dns='https://c.dns-shop.ru/thumb/st1/fit/500/500/a/front.jpg.webp';
const scan='https://showgames.ru/image/cache/catalog/covers/ps5/front-855x1000.jpg';
const document={warnings:[],games:[{id:'source',title:'Example',productIds:['sku','showgames-10'],platforms:[{name:'PS5',editions:[
  {id:'sku',name:'Standard',platforms:['PS5'],images:[dns],interfaceLanguages:['русский']},
  {id:'showgames-10',sourceProvider:'showgames',sourceProductId:'10',name:'Standard',platforms:['PS5'],images:[scan],interfaceLanguages:['русский']},
]}]}],stats:{},conventions:{}};
test('cover scans take priority and DNS images remain as fallbacks',()=>{
  assert.deepEqual(coverImages([dns,scan,dns]),[scan,dns]);
  const grouped=deduplicateDocument(document).document;
  assert.deepEqual(grouped.games[0].platforms[0].editions[0].images,[scan,dns]);
  assert.deepEqual(expandProducts(grouped).games[0].platforms[0].editions.map(e=>e.id).sort(),['showgames-10','sku']);
});
test('Showgames variants retain existing DNS IDs and do not pretend to be DNS SKUs',()=>{
  const initial=planCatalog({...document,games:[{...document.games[0],productIds:['sku'],platforms:[{name:'PS5',editions:[document.games[0].platforms[0].editions[0]]}]}]},[],[]);
  const plan=planCatalog(document,initial.createGames,initial.createEditions);
  assert.equal(plan.createGames.length,0);
  assert.equal(plan.createEditions[0].id,'showgames-10-ps5');
  assert.equal(plan.createEditions[0].dnsProductId,'');
  assert.equal(plan.dedup[0].canonicalId,'sku');
  assert.deepEqual(plan.dedup[0].coverImages,[scan,dns]);
  const editions=[{...initial.createEditions[0],coverImages:[scan,dns]}, {...plan.createEditions[0],canonicalId:'sku'}];
  const games=initial.createGames.map(g=>({...g,coverImage:scan}));
  const again=planCatalog(document,games,editions);
  assert.equal(again.createGames.length+again.createEditions.length+again.updateGames.length+again.updateEditions.length+again.dedup.length,0);
});
test('partial localisation joins only a unique compatible release without losing source facts',()=>{
  const make=(id,languages,provider)=>({id,sourceProvider:provider,sourceTitle:id,name:'Standard',platforms:['PS5'],interfaceLanguages:languages,images:[provider?scan:dns]});
  const wrap=(products,file)=>({warnings:[],conventions:{},source:{file,sha256:file,sourceCards:products.length},stats:{sourceCards:products.length},games:[{
    id:'game',title:'Example',genres:[],sourceGameTitles:[],productIds:products.map(p=>p.id),platforms:[{name:'PS5',editions:products}],
  }]});
  const base=wrap([make('sku',['английский','русский'])],'dns');
  const incoming=wrap([make('showgames-10',['русский'],'showgames')],'showgames');
  const merged=mergeShowgames(base,[incoming]).document;
  assert.equal(merged.games[0].platforms[0].editions.length,1);
  const products=expandProducts(merged).games[0].platforms[0].editions;
  assert.deepEqual(products.find(p=>p.id==='showgames-10').interfaceLanguages,['русский']);
  assert.deepEqual(merged.games[0].platforms[0].editions[0].images,[scan,dns]);
  const ambiguous=wrap([make('a',['английский','русский']),make('b',['русский'])],'dns');
  const unresolved=expandProducts(mergeShowgames(ambiguous,[incoming]).document).games[0].platforms[0].editions.find(p=>p.id==='showgames-10');
  assert.equal(unresolved.catalogueIdentity,undefined);
});
