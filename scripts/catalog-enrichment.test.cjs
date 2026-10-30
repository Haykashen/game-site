const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const manifest=JSON.parse(fs.readFileSync('exports/research-2026-10-30/verified-updates.json','utf8'));
const original=new Map(JSON.parse(fs.readFileSync('exports/research-2026-10-30/games-to-complete.json','utf8')).map(item=>[item.id,item]));
test('every proposed field fills a missing value and retains a source and immutable identity',()=>{
 assert.equal(new Set(manifest.map(item=>item.id)).size,manifest.length);
 const keys={year:'год выхода',developer:'разработчик',publisher:'издатель',description:'описание',genreNames:'жанры'};
 for(const item of manifest){assert.equal(original.get(item.id)?.игра,item.title);assert.match(item.source,/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+$/);for(const [field,value]of Object.entries(item.data)){assert.ok(Object.hasOwn(keys,field));assert.equal(original.get(item.id)[keys[field]],null);if(field==='year')assert.ok(Number.isInteger(value)&&value>=1950&&value<=2026);else if(field==='genreNames'){assert.ok(Array.isArray(value));assert.ok(!value.includes('Action RPG'));}else assert.ok(typeof value==='string'&&value.trim().length>0);}}
});
test('import preserves already populated fields, rejects changed titles and supports backup-only mode',async()=>{
 const script=fs.readFileSync('deploy/enrich-game-metadata.sh','utf8').match(/<<'CATALOG_RESEARCH_NODE'\r?\n([\s\S]+?)\r?\nCATALOG_RESEARCH_NODE/)[1].replace(/^import .*;\r?\n/m,'');
 const candidate=manifest.find(item=>item.data.publisher&&item.data.description);assert.ok(candidate);
 const writes=[];let backups=0;
 class PrismaClient {
  constructor(){this.game={findUnique:async({where})=>where.id===candidate.id?{id:candidate.id,title:candidate.title,year:2000,developer:'Keep existing developer',publisher:'',description:'',genres:[{id:'existing-genre'}]}:{id:where.id,title:'User renamed this game'},findMany:async()=>{backups++;return [{id:candidate.id}]},update:async args=>{writes.push(args);return args}};this.gameGenre={upsert:async()=>{throw Error('Existing genres must not be changed')}};}
  async $transaction(action){return action(this)} async $disconnect(){}
 }
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;const run=new AsyncFunction('PrismaClient','process','console',script);
 await run(PrismaClient,{env:{RESEARCH_MODE:'apply'}},{log(){}});assert.equal(writes.length,1);assert.equal(writes[0].where.id,candidate.id);assert.ok(!('year'in writes[0].data));assert.ok(!('developer'in writes[0].data));assert.ok(!('genres'in writes[0].data));assert.equal(writes[0].data.publisher,candidate.data.publisher);
 writes.length=0;await run(PrismaClient,{env:{RESEARCH_MODE:'backup'}},{log(){}});assert.equal(writes.length,0);assert.equal(backups,1);
});