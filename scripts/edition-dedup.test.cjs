const test=require('node:test'),assert=require('node:assert/strict');
const {planEditionDedup,deduplicateDocument,expandProducts}=require('./lib/edition-dedup.cjs');
const edition=(id,changes={})=>({id,gameId:'game',name:'Game Of The Year Edition',platform:'PS4',region:'Не указан',lang:'английский, русский',media:'Не указан',coverImages:['image-'+id],canonicalId:null,...changes});
test('same logical edition groups language-order/case variants, keeping all IDs and artwork',()=>{
  const plan=planEditionDedup([edition('a'),edition('b',{name:'Game of the Year Edition',lang:'русский, английский',description:'Different voice languages'})]);
  assert.equal(plan.length,1);assert.equal(plan[0].canonicalId,'a');
  assert.deepEqual(plan[0].variantIds,['b']);assert.deepEqual(plan[0].coverImages,['image-a','image-b']);
});
test('different platforms, regions, interface languages, media or editions stay separate',()=>{
  for(const change of [{platform:'PS5'},{region:'PAL'},{lang:'английский'},{media:'Цифровое издание'},{name:'Standard'}])
    assert.equal(planEditionDedup([edition('a'),edition('b',change)]).length,0);
});
test('previously grouped editions stay stable and repeat auditing produces no merges',()=>{
  assert.equal(planEditionDedup([edition('a'),edition('b',{canonicalId:'a'})]).length,0);
  const plan=planEditionDedup([edition('z'),edition('b',{canonicalId:'z'}),edition('a')]);
  assert.equal(plan[0].canonicalId,'z');assert.deepEqual(plan[0].variantIds,['a']);
});
test('JSON consolidation retains both source products and can be expanded losslessly',()=>{
  const products=['a','b'].map(id=>({id,name:'Game Of The Year Edition',interfaceLanguages:['русский'],images:['image-'+id]}));
  const source={conventions:{},stats:{},games:[{id:'game',title:'Example',productIds:['a','b'],platforms:[{name:'PS4',editions:products}]}]};
  const grouped=deduplicateDocument(source);
  assert.equal(grouped.document.games[0].platforms[0].editions.length,1);
  assert.deepEqual(grouped.document.games[0].platforms[0].editions[0].productIds,['a','b']);
  assert.deepEqual(expandProducts(grouped.document).games[0].platforms[0].editions,products);
});
