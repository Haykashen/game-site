ALTER TABLE "games" ADD COLUMN "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'draft', ADD COLUMN "moderation_note" TEXT, ADD COLUMN "moderated_at" TIMESTAMP(3), ADD COLUMN "moderator_id" UUID;
ALTER TABLE "editions" ADD COLUMN "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'draft', ADD COLUMN "moderation_note" TEXT, ADD COLUMN "moderated_at" TIMESTAMP(3), ADD COLUMN "moderator_id" UUID;
ALTER TABLE "games" DROP COLUMN "recognition_pending";
ALTER TABLE "editions" DROP COLUMN "recognition_pending";
