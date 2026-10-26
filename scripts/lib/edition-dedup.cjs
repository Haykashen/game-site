const {prioritizeImages}=require('./cover-images.cjs');
const normalize = value => String(value??'').normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const unknown = value => ['не указан','не указано','unknown',''].includes(normalize(value)) ? '' : normalize(value);
const editionName = value => ['standard','стандартное издание'].includes(normalize(value)) ? 'standard' : normalize(value);
function editionKey(edition) {
  return JSON.stringify([edition.gameId,normalize(edition.platform),editionName(edition.name),unknown(edition.region),
    String(edition.lang??'').split(',').map(unknown).filter(Boolean).sort(),unknown(edition.media)]);
}
function planEditionDedup(editions) {
  const groups=new Map();
  const referenced=new Set(editions.map(e=>e.canonicalId).filter(Boolean));
  for(const edition of editions.filter(e=>!e.canonicalId)) {
    const k=editionKey(edition);groups.set(k,[...(groups.get(k)??[]),edition]);
  }
  const merges=[];
  for(const group of groups.values()) {
    if(group.length<2)continue;
    const rank=e=>(referenced.has(e.id)?'0':e.id.startsWith('showgames-')?'3':/^[0-9a-f]{8}-/i.test(e.id)?'2':'1')+e.id;
    group.sort((a,b)=>rank(a).localeCompare(rank(b)));
    const canonical=group[0], replaced=new Set(group.slice(1).map(e=>e.id));
    for(const e of editions)if(replaced.has(e.canonicalId))replaced.add(e.id);
    merges.push({canonicalId:canonical.id,variantIds:[...replaced].sort(),coverImages:prioritizeImages([...group,...editions.filter(e=>replaced.has(e.canonicalId)||e.canonicalId===canonical.id)].flatMap(e=>e.coverImages??[]))});
  }
  return merges.sort((a,b)=>a.canonicalId.localeCompare(b.canonicalId));
}
async function applyEditionDedup(tx,merges) {
  const moved={copies:0,marketEntries:0};
  for(const merge of merges) {
    moved.copies+=(await tx.copy.updateMany({where:{editionId:{in:merge.variantIds}},data:{editionId:merge.canonicalId}})).count;
    moved.marketEntries+=(await tx.marketEntry.updateMany({where:{editionId:{in:merge.variantIds}},data:{editionId:merge.canonicalId}})).count;
    await tx.edition.updateMany({where:{id:{in:merge.variantIds}},data:{canonicalId:merge.canonicalId}});
    await tx.edition.update({where:{id:merge.canonicalId},data:{coverImages:merge.coverImages}});
  }
  return moved;
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
module.exports={editionKey,planEditionDedup,applyEditionDedup,expandProducts,deduplicateDocument};
