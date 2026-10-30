const fs=require('node:fs'),path=require('node:path');
const dir=path.join(process.cwd(),'exports/research-2026-10-30');const input=JSON.parse(fs.readFileSync(path.join(dir,'games-to-complete.json'),'utf8'));const research=JSON.parse(fs.readFileSync(path.join(dir,'wikidata-research.json'),'utf8'));const byId=new Map(input.map(game=>[game.id,game]));
const genreMap={'action role-playing game':['Action','RPG'],'role-playing video game':['RPG'],'role-playing game':['RPG'],'action-adventure game':['Action-adventure'],'action-adventure video game':['Action-adventure'],'action game':['Action'],'action video game':['Action'],'first-person shooter':['Shooter'],'third-person shooter':['Shooter'],'shooter game':['Shooter'],'platform game':['Platformer'],'platformer':['Platformer'],'racing video game':['Race'],'racing game':['Race'],'fighting game':['Fighting'],'stealth game':['Stealth'],'survival game':['Survival'],'survival horror':['Survival horror'],'survival horror game':['Survival horror'],'horror game':['Horror'],'strategy video game':['Strategy'],'real-time strategy':['Strategy'],'turn-based strategy video game':['Strategy'],'simulation video game':['Simulator'],'roguelike':['Rogue-like']};
const updates=[];for(const item of research){if(item.status!=='matched'||item.researchVersion!==2)continue;const original=byId.get(item.id);if(!original||original['игра']!==item.title)throw Error('Identity mismatch');const data={};if(original['год выхода']===null&&Number.isInteger(item.year))data.year=item.year;for(const [field,rus]of [['developer','разработчик'],['publisher','издатель']])if(original[rus]===null&&item[field]&&item[field].length<=2000)data[field]=item[field];if(original['жанры']===null){const genres=[...new Set(item.genres.flatMap(name=>genreMap[name.toLowerCase()]||[]))];if(genres.length)data.genreNames=genres;}
if(original['описание']===null&&item.year&&(item.developer||item.publisher)){const kind=/compilation/.test(item.descriptionEvidence)?'сборник видеоигр':/remaster/.test(item.descriptionEvidence)?'переиздание видеоигры':'видеоигра';data.description=`«${item.title}» — ${kind}, впервые выпущенная в ${item.year} году.`.replace('сборник видеоигр, впервые выпущенная','сборник видеоигр, впервые выпущенный').replace('переиздание видеоигры, впервые выпущенная','переиздание видеоигры, впервые выпущенное');if(item.developer)data.description+=` Разработчик: ${item.developer}.`;if(item.publisher)data.description+=` Издатель: ${item.publisher}.`;}
if(Object.keys(data).length)updates.push({id:item.id,title:item.title,data,source:item.source,officialWebsites:item.officialWebsite||[]});}
updates.sort((a,b)=>a.id.localeCompare(b.id));fs.writeFileSync(path.join(dir,'verified-updates.json'),JSON.stringify(updates,null,2)+'\n');
const shellHeader=`#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app_dir=$(realpath -e -- "\${1:?Installation directory}")
[[ "$app_dir" != / && -f "$app_dir/docker-compose.prod.yml" && -f "$app_dir/.env" ]]
exec 9>"$app_dir/.deploy/deploy.lock"
flock -n 9 || { echo 'Deployment is running'; exit 1; }
base=(docker compose --project-name discvault --project-directory "$app_dir" --env-file "$app_dir/.env" -f "$app_dir/docker-compose.prod.yml")
api=$("\${base[@]}" ps -q api)
[[ -n "$api" ]]
mkdir -p "$app_dir/.deploy/backups"
backup="$app_dir/.deploy/backups/catalog-enrichment-$(date -u +%Y%m%dT%H%M%SZ).json"
run_update() {
docker exec -i -e RESEARCH_MODE="$1" "$api" node --input-type=module <<'CATALOG_RESEARCH_NODE'
import {PrismaClient} from '@prisma/client';
const prisma=new PrismaClient();
const updates=${JSON.stringify(updates)};
`;
const code=`
const allowed=new Set(['year','developer','publisher','description','genreNames']);
if(new Set(updates.map(item=>item.id)).size!==updates.length||updates.some(item=>typeof item.id!=='string'||typeof item.title!=='string'||!item.source.startsWith('https://www.wikidata.org/wiki/Q')||Object.keys(item.data).some(field=>!allowed.has(field))))throw Error('Invalid verified manifest');
const empty=value=>value==null||typeof value==='string'&&(!value.trim()||/^(не указан[оа]?|неизвестно|unknown|n\\/a|описание игры пока не добавлено\\.?|описание отсутствует\\.?)$/i.test(value.trim()));
try {
 if(process.env.RESEARCH_MODE==='backup') {
  const games=await prisma.game.findMany({where:{id:{in:updates.map(item=>item.id)}},include:{genres:true}});
  console.log(JSON.stringify({createdAt:new Date().toISOString(),sources:updates,games}));
 }else{
  let changed=0;const fields={};const skipped=[];
  for(let start=0;start<updates.length;start+=25){const batch=updates.slice(start,start+25);await prisma.$transaction(async tx=>{
   for(const update of batch){
    const current=await tx.game.findUnique({where:{id:update.id},include:{genres:true}});
    if(!current||current.title!==update.title){skipped.push(update.id);continue;}
    const data={};for(const field of ['year','developer','publisher','description'])if(update.data[field]!==undefined&&empty(current[field])){data[field]=update.data[field];}
    if(!current.genres.length&&update.data.genreNames?.length){const ids=[];for(const name of update.data.genreNames){const genre=await tx.gameGenre.upsert({where:{name},create:{name},update:{}});ids.push({id:genre.id});}data.genres={connect:ids};}
    if(!Object.keys(data).length)continue;
    await tx.game.update({where:{id:update.id},data});changed++;for(const field of Object.keys(data))fields[field]=(fields[field]||0)+1;
   }
  },{isolationLevel:'Serializable',timeout:60000});}
  console.log(JSON.stringify({changed,fields,skipped,requested:updates.length}));
 }
} finally {await prisma.$disconnect();}
CATALOG_RESEARCH_NODE
}
run_update backup >"$backup"
[[ -s "$backup" ]]
echo "Backup created. Applying verified missing fields."
run_update apply
`;
fs.writeFileSync('deploy/enrich-game-metadata.sh',shellHeader+code);console.log(JSON.stringify({readyGames:updates.length,fields:Object.fromEntries(['year','developer','publisher','description','genreNames'].map(field=>[field,updates.filter(item=>item.data[field]!==undefined).length]))}));