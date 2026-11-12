const test=require('node:test'),assert=require('node:assert/strict');
const {deduplicateDocument,expandProducts}=require('./lib/edition-dedup.cjs');
test('JSON consolidation retains both source products and can be expanded losslessly',()=>{
  const products=['a','b'].map(id=>({id,name:'Game Of The Year Edition',interfaceLanguages:['русский'],images:['image-'+id]}));
  const source={conventions:{},stats:{},games:[{id:'game',title:'Example',productIds:['a','b'],platforms:[{name:'PS4',editions:products}]}]};
  const grouped=deduplicateDocument(source);
  assert.equal(grouped.document.games[0].platforms[0].editions.length,1);
  assert.deepEqual(grouped.document.games[0].platforms[0].editions[0].productIds,['a','b']);
  assert.deepEqual(expandProducts(grouped.document).games[0].platforms[0].editions,products);
});
