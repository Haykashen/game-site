const test=require('node:test'),assert=require('node:assert/strict');
const {mergeCatalog}=require('./lib/merge-dns-catalog.cjs');
const document=(id,title,platform,file)=>({source:{file,sha256:file},stats:{sourceCards:1},warnings:[],games:[{id,title,genres:[],sourceGameTitles:[title],productIds:[id],platforms:[{name:platform,editions:[{id,sourceTitle:title,platforms:[platform],images:['https://example.invalid/'+id],releaseDate:null}]}]}]});
test('Xbox editions join a PlayStation game while preserving existing IDs and records',()=>{
  const base=document('ps-id',"Assassin’s Creed: Odyssey",'PS5','ps.html');
  const addition=document('xbox-id',"Assassin's Creed Odyssey",'Xbox One','xbox.html');
  const merged=mergeCatalog(base,addition);
  assert.equal(merged.document.games.length,1);
  assert.equal(merged.document.games[0].id,'ps-id');
  assert.deepEqual(merged.document.games[0].platforms[0],base.games[0].platforms[0]);
  assert.equal(merged.document.stats.uniqueProducts,2);
  assert.equal(mergeCatalog(merged.document,addition).summary.addedEditions,0);
  assert.equal(mergeCatalog(merged.document,addition).document.source.files.length,2);
});
test('different sequels stay separate and conflicting product identities are rejected',()=>{
  const base=document('id','The Evil Within','PS4','ps.html');
  assert.equal(mergeCatalog(base,document('id-2','The Evil Within 2','Xbox One','xbox.html')).document.games.length,2);
  assert.throws(()=>mergeCatalog(base,document('id','Another Game','Xbox One','xbox.html')),/collision|identity/);
});
