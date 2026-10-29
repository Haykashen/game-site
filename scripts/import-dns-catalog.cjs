async function linkedSeries(tx, input) {
  if (Object.hasOwn(input, 'genres')) {const names=[...new Set(input.genres.flatMap(name=>name.trim().toLowerCase()==='action rpg'?['Action','RPG']:[name.trim()]).filter(Boolean))]; const records=[];for(const name of names) records.push(await tx.gameGenre.upsert({where:{name},create:{name},update:{}}));input={...input,genres:{set:records.map(({id})=>({id}))}};}
  if (!Object.hasOwn(input, 'series')) return input;
  const {series, ...data} = input;
  const name = (series ?? '').trim();
  const record = name ? await tx.gameSeries.upsert({where: {name}, create: {name}, update: {}}) : null;
  return {...data, seriesId: record?.id ?? null};
}
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const { planCatalog } = require('./lib/dns-catalog.cjs');
const {applyEditionDedup}=require('./lib/edition-dedup.cjs');
const { PrismaClient } = createRequire(resolve(process.cwd(),'package.json'))('@prisma/client');
const input = process.argv[2];
const apply = process.argv.includes('--apply');
const expected = process.argv.find(arg=>arg.startsWith('--expect='))?.slice(9);

async function main() {
  if (!input) throw Error('Usage: import-dns-catalog.cjs input.json [--apply --expect=PLAN_SHA256]');
  if (apply && !expected) throw Error('Apply requires the hash of a reviewed preview plan');
  const document = JSON.parse(fs.readFileSync(input,'utf8'));
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async tx => {
      if (apply) await tx.$executeRawUnsafe('LOCK TABLE "games", "editions" IN SHARE ROW EXCLUSIVE MODE');
      const games = await tx.game.findMany({orderBy:{id:'asc'}}), editions = await tx.edition.findMany({orderBy:{id:'asc'}});
      const plan = planCatalog(document,games,editions);
      if (apply && plan.hash !== expected) throw Error('Plan changed; run preview again. Nothing written.');
      const counts = async()=>({users:await tx.user.count(),copies:await tx.copy.count(),market:await tx.marketEntry.count(),bids:await tx.bid.count(),deals:await tx.deal.count(),ratings:await tx.gameRating.count(),discussions:await tx.discussion.count(),news:await tx.newsPost.count()});
      const before = await counts();
      let reassigned={copies:0,marketEntries:0};
      if (apply) {
        for (const game of plan.createGames) {const data=await linkedSeries(tx,game);if(data.genres) data.genres={connect:data.genres.set};await tx.game.create({data});}
        for (const update of plan.updateGames) await tx.game.update({where:{id:update.id},data:await linkedSeries(tx, update.data)});
        for (let i=0;i<plan.createEditions.length;i+=200) await tx.edition.createMany({data:plan.createEditions.slice(i,i+200)});
        for (const update of plan.updateEditions) await tx.edition.update({where:{id:update.id},data:await linkedSeries(tx, update.data)});
        const protectedGame = game=>{const {coverImage,updatedAt,...rest}=game;return rest;};
        for (const old of games) if (JSON.stringify(protectedGame(old))!==JSON.stringify(protectedGame(await tx.game.findUniqueOrThrow({where:{id:old.id}})))) throw Error('Existing game metadata changed; rollback');
        for (const old of editions) {
          const current = await tx.edition.findUniqueOrThrow({where:{id:old.id}});
          const mutable = new Set(['coverImages','dnsProductId','dnsProductCode','updatedAt']);
          for(const field of Object.keys(old)) if (!mutable.has(field) && JSON.stringify(old[field])!==JSON.stringify(current[field])) throw Error('Existing edition metadata changed; rollback');
        }
        reassigned=await applyEditionDedup(tx,plan.dedup);
      }
      const after = await counts();
      if (JSON.stringify(before)!==JSON.stringify(after)) throw Error('Related data changed during import; rollback');
      return {mode:apply?'applied':'preview',hash:plan.hash,...plan.summary,relatedTables:after,existingMetadataPreserved:true,reassigned,duplicates:plan.dedup,mappings:plan.mappings};
    }, {timeout:120000,isolationLevel:'Serializable'});
    console.log(JSON.stringify(result,null,2));
  } finally {await prisma.$disconnect();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
