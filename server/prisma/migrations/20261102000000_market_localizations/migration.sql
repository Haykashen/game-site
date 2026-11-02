CREATE TABLE "localizations" (
 "id" UUID PRIMARY KEY,
 "name" TEXT NOT NULL UNIQUE,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updated_at" TIMESTAMP(3) NOT NULL
);
INSERT INTO "localizations" ("id","name","updated_at") VALUES
('a1000000-0000-4000-8000-000000000001','Русская озвучка, субтитры и интерфейс',CURRENT_TIMESTAMP),
('a1000000-0000-4000-8000-000000000002','Русские субтитры и интерфейс',CURRENT_TIMESTAMP),
('a1000000-0000-4000-8000-000000000003','Русский интерфейс',CURRENT_TIMESTAMP),
('a1000000-0000-4000-8000-000000000004','На языке оригинала',CURRENT_TIMESTAMP);
ALTER TABLE "market_entries" ADD COLUMN "localization_id" UUID;
ALTER TABLE "market_entries" ADD CONSTRAINT "market_entries_localization_id_fkey" FOREIGN KEY ("localization_id") REFERENCES "localizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "market_entries_localization_id_idx" ON "market_entries"("localization_id");
