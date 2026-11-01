-- Existing publications stay visible; new submissions require approval.
ALTER TABLE "news_posts" ADD COLUMN "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'visible', ADD COLUMN "moderation_note" TEXT, ADD COLUMN "moderated_at" TIMESTAMP(3), ADD COLUMN "moderator_id" UUID;
ALTER TABLE "discussions" ADD COLUMN "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'visible', ADD COLUMN "moderation_note" TEXT, ADD COLUMN "moderated_at" TIMESTAMP(3), ADD COLUMN "moderator_id" UUID;
ALTER TABLE "news_posts" ALTER COLUMN "moderation_status" SET DEFAULT 'pending';
ALTER TABLE "discussions" ALTER COLUMN "moderation_status" SET DEFAULT 'pending';
CREATE INDEX "news_posts_moderation_status_idx" ON "news_posts"("moderation_status");
CREATE INDEX "discussions_moderation_status_idx" ON "discussions"("moderation_status");
