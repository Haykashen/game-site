-- Refuse ambiguous existing data instead of deleting or merging linked games.
-- Exact uniqueness is represented in Prisma; the expression index additionally
-- rejects case and whitespace variants of the same title.
BEGIN;
LOCK TABLE "games" IN SHARE ROW EXCLUSIVE MODE;
DROP INDEX IF EXISTS "games_title_idx";
CREATE UNIQUE INDEX "games_title_key" ON "games" ("title");
CREATE UNIQUE INDEX "games_title_normalized_key" ON "games"
  (lower(btrim(regexp_replace("title", '\s+', ' ', 'g'))));
ALTER TABLE "games" ALTER COLUMN "year" DROP NOT NULL;
COMMIT;
