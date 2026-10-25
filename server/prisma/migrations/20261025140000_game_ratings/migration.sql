CREATE TABLE "game_ratings" (
  "user_id" UUID NOT NULL,
  "game_id" TEXT NOT NULL,
  "score" INTEGER NOT NULL CHECK ("score" BETWEEN 1 AND 10),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "game_ratings_pkey" PRIMARY KEY ("user_id", "game_id"),
  CONSTRAINT "game_ratings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "game_ratings_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "game_ratings_game_id_idx" ON "game_ratings"("game_id");
