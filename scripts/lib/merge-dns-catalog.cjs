const { titleKey } = require('./dns-catalog.cjs');
const {expandProducts}=require('./edition-dedup.cjs');
function mergeCatalog(base, addition) {
  base=expandProducts(base);addition=expandProducts(addition);
  if (base.warnings?.length || addition.warnings?.length) throw Error('Resolve source warnings before merging');
  const result = structuredClone(base);
  const byTitle = new Map(result.games.map(g=>[titleKey(g.title),g]));
  const initialTitles = new Set(byTitle.keys());
  let matchedGames=0, newGames=0, addedProducts=0, addedEditions=0;
  const productOwners = new Map();
  for (const game of result.games) for (const id of game.productIds) {
    if (productOwners.has(id)) throw Error('Existing product is assigned to multiple games: '+id);
    productOwners.set(id,titleKey(game.title));
  }
  for (const incoming of addition.games) {
    const normalized = titleKey(incoming.title);
    let target = byTitle.get(normalized);
    if (target) matchedGames++;
    else {
      target={...structuredClone(incoming),platforms:[],productIds:[],genres:[],sourceGameTitles:[]};
      if (result.games.some(g=>g.id===target.id)) throw Error('Game ID collision: '+target.id);
      result.games.push(target);byTitle.set(normalized,target);newGames++;
    }
    for (const id of incoming.productIds) {
      if (productOwners.has(id) && productOwners.get(id)!==normalized) throw Error('Product changed game identity: '+id);
      productOwners.set(id,normalized);
      if (!target.productIds.includes(id)) {target.productIds.push(id);addedProducts++;}
    }
    for(const field of ['genres','sourceGameTitles']) for(const value of incoming[field]??[]) if(!target[field].includes(value))target[field].push(value);
    for(const sourcePlatform of incoming.platforms) {
      let platform=target.platforms.find(p=>p.name===sourcePlatform.name);
      if(!platform){platform={name:sourcePlatform.name,editions:[]};target.platforms.push(platform);}
      for(const edition of sourcePlatform.editions) {
        const existing=platform.editions.find(e=>e.id===edition.id);
        if(existing){if(existing.sourceTitle!==edition.sourceTitle)throw Error('Conflicting product snapshot: '+edition.id);continue;}
        platform.editions.push({...structuredClone(edition),sourceFile:addition.source.file});addedEditions++;
      }
    }
  }
  const sources = base.source.files ?? [{...base.source,sourceCards:base.stats.sourceCards}];
  const files = [...sources];
  if (!files.some(s=>s.sha256===addition.source.sha256)) files.push({...addition.source,sourceCards:addition.stats.sourceCards});
  result.source={type:'combined',files,baseUrl:'https://www.dns-shop.ru',extractedAt:new Date().toISOString()};
  const products=new Map(result.games.flatMap(g=>g.platforms.flatMap(p=>p.editions.map(e=>[e.id,e]))));
  result.stats={sourceCards:files.reduce((n,s)=>n+s.sourceCards,0),uniqueProducts:products.size,games:result.games.length,
    platformGroups:result.games.reduce((n,g)=>n+g.platforms.length,0),editionEntries:result.games.reduce((n,g)=>n+g.platforms.reduce((m,p)=>m+p.editions.length,0),0),
    productsWithImages:[...products.values()].filter(e=>e.images.length).length,productsWithReleaseDate:[...products.values()].filter(e=>e.releaseDate).length,
    multiPlatformProducts:[...products.values()].filter(e=>e.platforms.length>1).length};
  result.warnings=[];
  return {document:result,summary:{matchedGames,newGames,addedProducts,addedEditions},newTitles:addition.games.filter(g=>!initialTitles.has(titleKey(g.title))).map(g=>g.title)};
}
module.exports={mergeCatalog};
