ALTER TABLE "games" ADD COLUMN "recognition_pending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "editions" ADD COLUMN "recognition_pending" BOOLEAN NOT NULL DEFAULT false;