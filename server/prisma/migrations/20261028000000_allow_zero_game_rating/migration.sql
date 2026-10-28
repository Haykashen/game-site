ALTER TABLE "game_ratings" DROP CONSTRAINT "game_ratings_score_check";
ALTER TABLE "game_ratings" ADD CONSTRAINT "game_ratings_score_check" CHECK ("score" BETWEEN 0 AND 10);
