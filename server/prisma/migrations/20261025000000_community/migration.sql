-- CreateEnum
CREATE TYPE "NewsCategory" AS ENUM ('release', 'guide', 'community', 'update');

-- CreateTable
CREATE TABLE "discussions" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tags" TEXT[],
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "views" INTEGER NOT NULL DEFAULT 0,
    "is_seeded" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discussions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discussion_comments" (
    "id" TEXT NOT NULL,
    "discussion_id" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "parent_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discussion_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_posts" (
    "id" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "game_id" TEXT,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "NewsCategory" NOT NULL,
    "tags" TEXT[],
    "is_seeded" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "news_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discussions_game_id_pinned_updated_at_idx" ON "discussions"("game_id", "pinned", "updated_at");

-- CreateIndex
CREATE INDEX "discussions_updated_at_idx" ON "discussions"("updated_at");

-- CreateIndex
CREATE INDEX "discussions_author_id_idx" ON "discussions"("author_id");

-- CreateIndex
CREATE INDEX "discussion_comments_discussion_id_created_at_idx" ON "discussion_comments"("discussion_id", "created_at");

-- CreateIndex
CREATE INDEX "discussion_comments_parent_id_idx" ON "discussion_comments"("parent_id");

-- CreateIndex
CREATE INDEX "discussion_comments_author_id_idx" ON "discussion_comments"("author_id");

-- CreateIndex
CREATE INDEX "news_posts_published_at_idx" ON "news_posts"("published_at");

-- CreateIndex
CREATE INDEX "news_posts_category_published_at_idx" ON "news_posts"("category", "published_at");

-- CreateIndex
CREATE INDEX "news_posts_game_id_idx" ON "news_posts"("game_id");

-- CreateIndex
CREATE INDEX "news_posts_author_id_idx" ON "news_posts"("author_id");

-- AddForeignKey
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_discussion_id_fkey" FOREIGN KEY ("discussion_id") REFERENCES "discussions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "discussion_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;
