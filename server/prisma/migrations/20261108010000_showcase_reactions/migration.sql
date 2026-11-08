
CREATE TABLE "copy_share_likes" ("share_id" UUID NOT NULL, "user_id" UUID NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "copy_share_likes_pkey" PRIMARY KEY ("share_id", "user_id"));
CREATE INDEX "copy_share_likes_user_id_idx" ON "copy_share_likes"("user_id");
ALTER TABLE "copy_share_likes" ADD CONSTRAINT "copy_share_likes_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "copy_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "copy_share_likes" ADD CONSTRAINT "copy_share_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "copy_share_comments" ("id" UUID NOT NULL, "share_id" UUID NOT NULL, "user_id" UUID NOT NULL, "body" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "copy_share_comments_pkey" PRIMARY KEY ("id"));
CREATE INDEX "copy_share_comments_share_id_created_at_id_idx" ON "copy_share_comments"("share_id", "created_at", "id");
CREATE INDEX "copy_share_comments_user_id_idx" ON "copy_share_comments"("user_id");
ALTER TABLE "copy_share_comments" ADD CONSTRAINT "copy_share_comments_share_id_fkey" FOREIGN KEY ("share_id") REFERENCES "copy_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "copy_share_comments" ADD CONSTRAINT "copy_share_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
