const fs = require('node:fs');
const groups = [
 ['Game','games','game_statuses'], ['Edition','editions','game_statuses'],
 ['MarketEntry','market_entries','market_entry_statuses'], ['NewsPost','news_posts','content_statuses'],
 ['Discussion','discussions','content_statuses'], ['User','users','account_statuses'],
 ['Deal','deals','transaction_statuses'], ['Report','reports','complaint_statuses'],
];
let schema = fs.readFileSync('server/prisma/schema.prisma','utf8');
if (schema.includes('model Status {')) throw Error('Unified status schema already exists');
schema = schema.replace(/model (GameStatus|MarketEntryStatus|ContentStatus|AccountStatus|TransactionStatus|ComplaintStatus) \{[^}]*\}\s*/g,'');
schema = schema.replace(/statusReference (GameStatus|MarketEntryStatus|ContentStatus|AccountStatus|TransactionStatus|ComplaintStatus) /g,'statusReference Status ');
schema += `\nenum StatusEntity {\n  Game\n  Edition\n  Listing\n  Auction\n  NewsPost\n  Discussion\n  User\n  Deal\n  Report\n}\n\nmodel Status {\n  id String @id @default(uuid()) @db.Uuid\n  entity StatusEntity\n  code String\n  name String\n  description String @default("")\n  sortOrder Int @default(0) @map("sort_order")\n  createdAt DateTime @default(now()) @map("created_at")\n  updatedAt DateTime @updatedAt @map("updated_at")\n${groups.map(([model])=>`  ${model[0].toLowerCase()+model.slice(1)}Records ${model}[]`).join('\n')}\n  @@unique([entity, code])\n  @@map("statuses")\n}\n`;
let sql = `CREATE TYPE "StatusEntity" AS ENUM ('Game','Edition','Listing','Auction','NewsPost','Discussion','User','Deal','Report');\nCREATE TABLE statuses (id UUID PRIMARY KEY, entity "StatusEntity" NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL);\nCREATE UNIQUE INDEX statuses_entity_code_key ON statuses(entity,code);\n`;
for (const [model, table, oldTable] of groups) {
  for (const entity of model==='MarketEntry'?['Listing','Auction']:[model]) sql+=`INSERT INTO statuses(id,entity,code,name,description,sort_order,created_at,updated_at) SELECT md5('${entity}:'||code)::uuid,'${entity}',code,name,description,sort_order,created_at,updated_at FROM ${oldTable};\n`;
  const entity = model==='MarketEntry'?`CASE WHEN NEW.kind::text='auction' THEN 'Auction' ELSE 'Listing' END`:`'${model}'`;
  const entityForUpdate=model==='MarketEntry'?`CASE WHEN source.kind::text='auction' THEN 'Auction' ELSE 'Listing' END`:`'${model}'`;
  sql+=`DROP TRIGGER sync_status ON ${table};\nALTER TABLE ${table} DROP CONSTRAINT ${table}_status_id_fkey;\nUPDATE ${table} AS source SET status_id=target.id FROM ${oldTable} AS old, statuses AS target WHERE source.status_id=old.id AND target.code=old.code AND target.entity::text=(${entityForUpdate});\nALTER TABLE ${table} ADD CONSTRAINT ${table}_status_id_fkey FOREIGN KEY(status_id) REFERENCES statuses(id) ON DELETE RESTRICT ON UPDATE CASCADE;\n`;
  const moderated=['Game','Edition','NewsPost','Discussion'].includes(model);
  const derive=model==='MarketEntry'?`CASE WHEN NEW.status::text='sold' THEN 'sold' WHEN NEW.status::text='closed' THEN 'closed' WHEN NEW.moderation_status::text='visible' THEN 'active' WHEN NEW.moderation_status::text='hidden' THEN 'rejected' ELSE NEW.moderation_status::text END`: moderated?'NEW.moderation_status::text':'NEW.status::text';
  const reverse=model==='MarketEntry'?`NEW.status := (CASE WHEN chosen='sold' THEN 'sold' WHEN chosen='closed' THEN 'closed' ELSE 'active' END)::"MarketStatus"; NEW.moderation_status := (CASE WHEN chosen IN ('active','sold','closed') THEN 'visible' WHEN chosen='rejected' THEN 'hidden' ELSE chosen END)::"ModerationStatus";`:moderated?`NEW.moderation_status := chosen::"ModerationStatus";`:`NEW.status := chosen::"${model==='User'?'UserStatus':model==='Deal'?'DealStatus':'ReportStatus'}";`;
  sql+=`CREATE OR REPLACE FUNCTION sync_${table}_status() RETURNS trigger LANGUAGE plpgsql AS $$\nDECLARE chosen TEXT; owner_entity TEXT;\nBEGIN\n  owner_entity := ${entity};\n  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN\n    SELECT code INTO chosen FROM statuses WHERE id=NEW.status_id AND entity::text=owner_entity;\n    IF chosen IS NULL THEN RAISE EXCEPTION 'Status does not belong to entity %',owner_entity USING ERRCODE='23503'; END IF;\n    ${reverse}\n  ELSE\n    chosen := ${derive};\n    SELECT id INTO NEW.status_id FROM statuses WHERE code=chosen AND entity::text=owner_entity;\n  END IF;\n  RETURN NEW;\nEND $$;\nCREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION sync_${table}_status();\n`;
}
for(const table of [...new Set(groups.map(group=>group[2]))])sql+=`DROP TABLE ${table};\n`;
sql+=`CREATE FUNCTION protect_status_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.code IS DISTINCT FROM OLD.code OR NEW.entity IS DISTINCT FROM OLD.entity OR NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'System status identity cannot change' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;\nCREATE TRIGGER protect_status_identity BEFORE UPDATE ON statuses FOR EACH ROW EXECUTE FUNCTION protect_status_identity();\n`;
fs.mkdirSync('server/prisma/migrations/20261102040000_unified_statuses',{recursive:true});
fs.writeFileSync('server/prisma/migrations/20261102040000_unified_statuses/migration.sql',sql);
fs.writeFileSync('server/prisma/schema.prisma',schema);
