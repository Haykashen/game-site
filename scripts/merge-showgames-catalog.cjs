const fs=require('node:fs');
const {mergeCatalog}=require('./lib/merge-dns-catalog.cjs');
const {deduplicateDocument,expandProducts,editionKey}=require('./lib/edition-dedup.cjs');
const {titleKey}=require('./lib/dns-catalog.cjs');
const explicitAliases=new Map(Object.entries({
  'A Plague Tale: Innocence':'A Plague Tale: Innocence HD',
  'The Last of Us Part I':'The Last of Us: Part I (Remake)',
  'Resident Evil 9 Requiem':'Resident Evil Requiem',
  'Gothic 1 Remake':'Gothic Remake',
  'The Dark Pictures Anthology: House of Ashes':'The Dark Pictures: House of Ashes',
  'The Dark Pictures Anthology: Little Hope':'The Dark Pictures: Little Hope',
  'The Dark Pictures Anthology: Man of Medan':'The Dark Pictures: Man of Medan',
  'The Dark Pictures Triple Pack':'The Dark Pictures Anthology: Triple Pack',
  'Hot Wheels Unleashed 2: Turbocharged':'Hot Wheels Unleashed 2',
  'Metal Gear Solid V The Definitive Experience':'Metal Gear Solid V: Definitive Experience',
  'Call of Duty Modern Warfare 2019':'Call of Duty: Modern Warfare',
  'Pro Evolution Soccer PES 2018':'Pro Evolution Soccer 2018',
  'PES 2018: Pro Evolution Soccer':'Pro Evolution Soccer 2018',
  'PES 2015 Pro Evolution Soccer':'Pro Evolution Soccer 2015',
  'Tokyo 2020 Olympic Games Official Videogame':'Tokyo 2020 Olympic Games',
  'Комплект игр Far Cry 4 + Far Cry 5':'Far Cry 4 + Far Cry 5',
  'Комплект игр Far Cry 4 + Far Cry Primal':'Far Cry: Primal + Far Cry 4',
  'Starlink Battle for Atlas':'Starlink Battle for Atlas - Starter Pack',
  'Disney / Pixar Валл-И':'Disney / Pixar Валл-И (Wall E)',
  'История Игрушек: Парк развлечений (Toy Story Mania!)':'История Игрушек Парк развлечений',
  'Destroy All Humans! 2 - Reprobed: Single Player':'Destroy All Humans! 2 Single Player',
  'Assassin’s Creed Chronicles: Трилогия':"Assassin's Creed Chronicles Trilogy",
}).map(([a,b])=>[titleKey(a),b]));
// Orthographic equality only. No substring/fuzzy matches between sequels.
function matchKey(title){
  const roman={ii:'2',iii:'3',iv:'4',v:'5',vi:'6',vii:'7',viii:'8',ix:'9',x:'10'};
  return titleKey(title.replace(/&/g,' and ')).replace(/^the /,'').replace(/\b(ii|iii|iv|v|vi|vii|viii|ix|x)\b/g,s=>roman[s]);
}
function mergeShowgames(base,additions){
  let document=base;const matches=[];
  for(const addition of additions){
    const index=new Map();
    for(const game of document.games){const key=matchKey(game.title);index.set(key,[...(index.get(key)??[]),game]);}
    const corrected=structuredClone(addition);
    for(const game of corrected.games){
      const alias=explicitAliases.get(titleKey(game.title));
      const exact=document.games.find(g=>titleKey(g.title)===titleKey(alias??game.title));
      const candidates=index.get(matchKey(game.title))??[];
      const target=exact??(candidates.length===1?candidates[0]:null);
      if(target){matches.push({source:game.title,target:target.title,sourceFile:addition.source.file});game.title=target.title;}
      else index.set(matchKey(game.title),[game]);
      // A shop's "Russian version" is partial language information, not proof
      // of a different edition from a bilingual DNS listing. Join only a unique
      // compatible existing release; keep the original source fields intact.
      const targetGame=target&&expandProducts({games:[target]}).games[0];
      if(targetGame)for(const platform of game.platforms)for(const product of platform.editions){
        const identity=p=>editionKey({gameId:'match',platform:platform.name,name:p.name,region:'',lang:'',media:p.editionType==='цифровое издание'?'digital':''});
        const norm=s=>String(s??'').toLowerCase().trim();
        const languages=p=>(p.interfaceLanguages??[]).map(norm);
        const candidates=(targetGame.platforms.find(p=>p.name===platform.name)?.editions??[]).filter(p=>
          p.sourceProvider!=='showgames' && identity(p)===identity(product) &&
          (!product.region||!p.region||norm(product.region)===norm(p.region)) &&
          languages(product).every(lang=>languages(p).includes(lang)));
        const groups=new Map(candidates.map(p=>[editionKey({gameId:'match',platform:platform.name,name:p.name,region:p.region,lang:p.interfaceLanguages?.join(', '),media:''}),p]));
        if(groups.size===1){const p=[...groups.values()][0];product.catalogueIdentity={matchedProductId:p.id,name:p.name,region:p.region??'',interfaceLanguages:p.interfaceLanguages??[],reason:'Unique compatible existing edition; source language list may be incomplete.'};}
      }
    }
    // Several source spellings can resolve to the same game, which mergeCatalog supports.
    document=mergeCatalog(document,corrected).document;
  }
  const dedup=deduplicateDocument(document);
  return {...dedup,matches};
}
if(require.main===module){const [baseFile,output,...files]=process.argv.slice(2);const result=mergeShowgames(JSON.parse(fs.readFileSync(baseFile,'utf8')),files.map(f=>JSON.parse(fs.readFileSync(f,'utf8'))));fs.writeFileSync(output,JSON.stringify(result.document,null,2)+'\n');fs.writeFileSync(output.replace(/\.json$/,'-duplicates.json'),JSON.stringify(result.report,null,2)+'\n');fs.writeFileSync(output.replace(/\.json$/,'-matches.json'),JSON.stringify(result.matches,null,2)+'\n');console.log(JSON.stringify({stats:result.document.stats,matchedGroups:result.matches.length,duplicateGroups:result.report.length},null,2));}
module.exports={mergeShowgames,matchKey};
