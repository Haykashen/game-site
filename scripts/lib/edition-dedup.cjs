const {prioritizeImages}=require('./cover-images.cjs');
const normalize = value => String(value??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const unknown = value => ['не указан','не указано','unknown',''].includes(normalize(value)) ? '' : normalize(value);
const editionName = value => ['standard','стандартное издание'].includes(normalize(value)) ? 'standard' : normalize(value);
function regionKey(value) {
 const raw=normalize(value?.code??value);
 return ({'':'eur','не указан':'eur','не указано':'eur','unknown':'eur','pal':'eur','eu':'eur','ntsc-j':'jpn','jp':'jpn','ntsc-u':'usa','ntsc-u/c':'usa','us':'usa','ru':'rus'})[raw]??raw;
}
function editionKey(edition) {
  return JSON.stringify([edition.gameId,normalize(edition.platform),editionName(edition.name),regionKey(edition.region ?? edition.regionId),
    [...new Set(String(edition.lang??'').split(/[,;]/).map(unknown).filter(Boolean))].sort(),unknown(edition.media)]);
}
function expandProducts(document) {
  const result=structuredClone(document);
  for(const game of result.games)for(const platform of game.platforms)platform.editions=platform.editions.flatMap(e=>e.products??[e]);
  return result;
}
function deduplicateDocument(document) {
  const result=expandProducts(document);
  const report=[];
  for(const game of result.games)for(const platform of game.platforms) {
    const groups=new Map();
    for(const product of platform.editions){
      const identity=product.catalogueIdentity??product;
      const k=editionKey({gameId:game.id,platform:platform.name,name:identity.name,region:identity.region,
        lang:identity.interfaceLanguages?.join(', '),media:product.editionType==='цифровое издание'?'Цифровое издание':''});
      groups.set(k,[...(groups.get(k)??[]),product]);
    }
    platform.editions=[...groups.values()].map(products=>{
      if(products.length===1)return products[0];
      products.sort((a,b)=>a.id.localeCompare(b.id));
      const canonical=products[0],images=prioritizeImages(products.flatMap(p=>p.images??[]));
      report.push({gameId:game.id,game:game.title,platform:platform.name,name:canonical.name,productIds:products.map(p=>p.id)});
      return {...canonical,products,productIds:products.map(p=>p.id),image:images[0]??null,images,
        imageVariants:[...new Map(products.flatMap(p=>p.imageVariants??[]).map(v=>[v.url,v])).values()]};
    });
  }
  result.schemaVersion=2;
  result.stats.editionEntries=result.games.reduce((n,g)=>n+g.platforms.reduce((m,p)=>m+p.editions.length,0),0);
  result.stats.productPlatformEntries=result.games.reduce((n,g)=>n+g.platforms.reduce((m,p)=>m+p.editions.reduce((k,e)=>k+(e.products?.length??1),0),0),0);
  result.conventions.logicalEdition='Одна карточка издания на игру, платформу, название, регион, язык интерфейса и носитель. Отличия товаров сохранены в products[].';
  return {document:result,report};
}
module.exports={editionKey,expandProducts,deduplicateDocument};
