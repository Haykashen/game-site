ALTER TABLE "games" ADD COLUMN "series_id" TEXT;
INSERT INTO "game_series" ("id", "name", "created_at", "updated_at")
SELECT gen_random_uuid()::text, names.name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT btrim("series") AS name FROM "games" WHERE btrim("series") <> '') names
ON CONFLICT ("name") DO NOTHING;
UPDATE "games" g SET "series_id" = s."id" FROM "game_series" s WHERE s."name" = btrim(g."series");
ALTER TABLE "games" ADD CONSTRAINT "games_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "game_series"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "games_series_id_idx" ON "games"("series_id");
ALTER TABLE "games" DROP COLUMN "series";