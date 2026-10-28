-- CreateTable
CREATE TABLE "game_genres" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_genres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_series" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_genres_name_key" ON "game_genres"("name");

-- CreateIndex
CREATE UNIQUE INDEX "game_series_name_key" ON "game_series"("name");

-- Seed reference rows from the values already stored on games.
INSERT INTO "game_genres" ("id", "name", "updated_at")
SELECT gen_random_uuid(), btrim(genre), CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT btrim(g.genre) AS genre
    FROM "games" CROSS JOIN LATERAL unnest("genres") AS g(genre)
) AS source
WHERE genre <> ''
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "game_series" ("id", "name", "updated_at")
SELECT gen_random_uuid(), btrim(series), CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT btrim("series") AS series
    FROM "games"
) AS source
WHERE series <> ''
ON CONFLICT ("name") DO NOTHING;
