CREATE TABLE "_GameGenres" (
 "A" TEXT NOT NULL REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "B" UUID NOT NULL REFERENCES "game_genres"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "_GameGenres_AB_unique" ON "_GameGenres"("A","B");
CREATE INDEX "_GameGenres_B_index" ON "_GameGenres"("B");
INSERT INTO "game_genres" ("id","name","created_at","updated_at")
SELECT gen_random_uuid(), name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM (
 SELECT DISTINCT unnest(CASE WHEN lower(btrim(value))='action rpg' THEN ARRAY['Action','RPG'] ELSE ARRAY[btrim(value)] END) name
 FROM "games", unnest("genres") value
 UNION SELECT unnest(ARRAY['Action','RPG'])
) names WHERE name<>'' ON CONFLICT ("name") DO NOTHING;
INSERT INTO "_GameGenres" ("A","B")
SELECT DISTINCT g."id", genre."id" FROM "games" g
CROSS JOIN LATERAL unnest(g."genres") value
CROSS JOIN LATERAL unnest(CASE WHEN lower(btrim(value))='action rpg' THEN ARRAY['Action','RPG'] ELSE ARRAY[btrim(value)] END) AS expanded(genre_name)
JOIN "game_genres" genre ON genre."name"=expanded.genre_name
ON CONFLICT DO NOTHING;
DELETE FROM "game_genres" WHERE lower(btrim("name"))='action rpg';
ALTER TABLE "games" DROP COLUMN "genres";