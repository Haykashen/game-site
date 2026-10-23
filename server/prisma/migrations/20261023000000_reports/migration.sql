-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'moderator', 'admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'deleted');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('visible', 'hidden', 'removed');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('market_entry', 'user');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('fraud', 'prohibited', 'offensive', 'spam', 'wrong_category', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('pending', 'in_review', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ReportAction" AS ENUM ('none', 'hide_entry', 'suspend_user');

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'user',
ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'active',
ADD COLUMN "suspended_at" TIMESTAMP(3),
ADD COLUMN "suspension_reason" TEXT;

-- AlterTable
ALTER TABLE "market_entries"
ADD COLUMN "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'visible',
ADD COLUMN "moderation_note" TEXT,
ADD COLUMN "moderated_at" TIMESTAMP(3),
ADD COLUMN "moderator_id" UUID;

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" TEXT NOT NULL,
    "market_entry_id" TEXT,
    "target_user_id" UUID,
    "reason" "ReportReason" NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "status" "ReportStatus" NOT NULL DEFAULT 'pending',
    "action" "ReportAction" NOT NULL DEFAULT 'none',
    "moderator_id" UUID,
    "moderator_note" TEXT,
    "active_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reports_target_check" CHECK (
        ("target_type" = 'market_entry' AND "market_entry_id" IS NOT NULL AND "target_user_id" IS NULL)
        OR
        ("target_type" = 'user' AND "target_user_id" IS NOT NULL AND "market_entry_id" IS NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "reports_active_key_key" ON "reports"("active_key");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "reports_target_type_target_id_idx" ON "reports"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "reports_reporter_id_idx" ON "reports"("reporter_id");

-- CreateIndex
CREATE INDEX "reports_market_entry_id_idx" ON "reports"("market_entry_id");

-- CreateIndex
CREATE INDEX "reports_target_user_id_idx" ON "reports"("target_user_id");

-- CreateIndex
CREATE INDEX "market_entries_moderation_status_idx" ON "market_entries"("moderation_status");

-- AddForeignKey
ALTER TABLE "market_entries" ADD CONSTRAINT "market_entries_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_market_entry_id_fkey" FOREIGN KEY ("market_entry_id") REFERENCES "market_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_moderator_id_fkey" FOREIGN KEY ("moderator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
