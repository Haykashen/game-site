const fs = require('node:fs');
const path = require('node:path');
const groups = [
  {model:'GameStatus', table:'game_statuses', entities:[['Game','games'],['Edition','editions']], values:{draft:'Черновик',pending:'На проверке',visible:'Проверено',hidden:'Отклонено',removed:'Снято с публикации'}, mode:'moderation'},
  {model:'MarketEntryStatus',table:'market_entry_statuses',entities:[['MarketEntry','market_entries']],values:{draft:'Черновик',pending:'На проверке',active:'Активно',rejected:'Отклонено',sold:'Продано',closed:'Закрыто',removed:'Удалено'},mode:'market'},
  {model:'ContentStatus',table:'content_statuses',entities:[['NewsPost','news_posts'],['Discussion','discussions']],values:{draft:'Черновик',pending:'На проверке',visible:'Опубликовано',hidden:'Отклонено',removed:'Снято с публикации'},mode:'moderation'},
  {model:'AccountStatus',table:'account_statuses',entities:[['User','users']],values:{active:'Активен',suspended:'Заблокирован',deleted:'Удалён'},mode:'plain'},
  {model:'TransactionStatus',table:'transaction_statuses',entities:[['Deal','deals']],values:{pending:'Ожидает',completed:'Завершена',cancelled:'Отменена'},mode:'plain'},
  {model:'ComplaintStatus',table:'complaint_statuses',entities:[['Report','reports']],values:{pending:'На рассмотрении',in_review:'В работе',resolved:'Решена',dismissed:'Отклонена'},mode:'plain'},
];
let schema=fs.readFileSync('server/prisma/schema.prisma','utf8');
let sql='-- Status directories are authoritative; legacy columns remain synchronized for API compatibility.\n';
for(const group of groups){
  if(schema.includes(`model ${group.model} {`)) throw Error('Status schema already generated');
  schema+=`\nmodel ${group.model} {\n  id String @id @default(uuid()) @db.Uuid\n  code String @unique\n  name String\n  description String @default("")\n  sortOrder Int @default(0) @map("sort_order")\n  createdAt DateTime @default(now()) @map("created_at")\n  updatedAt DateTime @updatedAt @map("updated_at")\n${group.entities.map(([model])=>`  ${model[0].toLowerCase()+model.slice(1)}Records ${model}[]`).join('\n')}\n  @@map("${group.table}")\n}\n`;
  sql+=`CREATE TABLE "${group.table}" (id UUID PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL);\n`;
  Object.entries(group.values).forEach(([code,label],i)=>{sql+=`INSERT INTO "${group.table}" (id,code,name,sort_order,updated_at) VALUES (md5('${group.table}:${code}')::uuid,'${code}','${label}',${i},CURRENT_TIMESTAMP);\n`;});
  for(const [model,table] of group.entities){
    schema=schema.replace(`model ${model} {`,`model ${model} {\n  statusId String @default(dbgenerated()) @map("status_id") @db.Uuid\n  statusReference ${group.model} @relation(fields: [statusId], references: [id], onDelete: Restrict, onUpdate: Cascade)\n  @@index([statusId])`);
    const derive=group.mode==='market' ? `CASE WHEN NEW.status::text='sold' THEN 'sold' WHEN NEW.status::text='closed' THEN 'closed' WHEN NEW.moderation_status::text='visible' THEN 'active' WHEN NEW.moderation_status::text='hidden' THEN 'rejected' ELSE NEW.moderation_status::text END` : group.mode==='moderation' ? 'NEW.moderation_status::text' : 'NEW.status::text';
    const reverse=group.mode==='market' ? `NEW.status := (CASE WHEN chosen='sold' THEN 'sold' WHEN chosen='closed' THEN 'closed' ELSE 'active' END)::"MarketStatus"; NEW.moderation_status := (CASE WHEN chosen IN ('active','sold','closed') THEN 'visible' WHEN chosen='rejected' THEN 'hidden' ELSE chosen END)::"ModerationStatus";` : group.mode==='moderation' ? `NEW.moderation_status := chosen::"ModerationStatus";` : `NEW.status := chosen::"${model==='User'?'UserStatus':model==='Deal'?'DealStatus':'ReportStatus'}";`;
    sql+=`ALTER TABLE "${table}" ADD COLUMN status_id UUID;\n`;
    sql+=`CREATE FUNCTION sync_${table}_status() RETURNS trigger LANGUAGE plpgsql AS $$\nDECLARE chosen TEXT;\nBEGIN\n  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN\n    SELECT code INTO chosen FROM "${group.table}" WHERE id=NEW.status_id;\n    IF chosen IS NULL THEN RAISE EXCEPTION 'Unknown status' USING ERRCODE='23503'; END IF;\n    ${reverse}\n  ELSE\n    chosen := ${derive};\n    SELECT id INTO NEW.status_id FROM "${group.table}" WHERE code=chosen;\n  END IF;\n  RETURN NEW;\nEND $$;\nCREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON "${table}" FOR EACH ROW EXECUTE FUNCTION sync_${table}_status();\nUPDATE "${table}" SET status_id=NULL;\nALTER TABLE "${table}" ALTER COLUMN status_id SET NOT NULL;\nALTER TABLE "${table}" ADD CONSTRAINT "${table}_status_id_fkey" FOREIGN KEY(status_id) REFERENCES "${group.table}"(id) ON DELETE RESTRICT ON UPDATE CASCADE;\nCREATE INDEX "${table}_status_id_idx" ON "${table}"(status_id);\n`;
  }
}
const dir='server/prisma/migrations/20261102030000_status_directories';
fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'migration.sql'),sql);fs.writeFileSync('server/prisma/schema.prisma',schema);
