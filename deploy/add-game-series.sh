#!/usr/bin/env bash
set -Eeuo pipefail
app_dir=$(realpath -e -- "${1:?Installation directory}")
[[ "$app_dir" != / && -f "$app_dir/docker-compose.prod.yml" && -f "$app_dir/.env" ]]
base=(docker compose --project-name discvault --project-directory "$app_dir" --env-file "$app_dir/.env" -f "$app_dir/docker-compose.prod.yml")
api=$("${base[@]}" ps -q api)
[[ -n "$api" ]]
docker exec -i "$api" node --input-type=module <<'NODE'
import {PrismaClient} from '@prisma/client';
const prisma=new PrismaClient();
const requested=['Need for Speed','Street Fighter','Mortal Kombat','Doom','Mass Effect','Fallout','Metal Gear Solid','Dark Souls','The Witcher','Diablo','Assassin’s Creed','Red Dead Redemption','Resident Evil','Final Fantasy','The Elder Scrolls','Minecraft','Call of Duty','Grand Theft Auto','Civilization','Metroid','Castlevania','Batman: Arkham','Tomb Raider'];
const normalize=value=>value.normalize('NFKC').replace(/[’‘`]/g,"'").trim().replace(/\s+/g,' ').toLowerCase();
try {
 const result=await prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('series-directory'))`;
  const existing=await tx.gameSeries.findMany({select:{id:true,name:true}});
  const names=new Set(existing.map(item=>normalize(item.name)));
  const added=[],present=[];
  for(const name of requested){if(names.has(normalize(name))){present.push(name);continue;}await tx.gameSeries.create({data:{name}});names.add(normalize(name));added.push(name);}
  const after=await tx.gameSeries.findMany({select:{name:true}});
  if(requested.some(name=>!after.some(item=>normalize(item.name)===normalize(name))))throw Error('Verification failed');
  return {added,present,totalRequested:requested.length};
 });console.log(JSON.stringify(result));
}finally{await prisma.$disconnect();}
NODE