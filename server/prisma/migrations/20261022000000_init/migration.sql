-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MarketKind" AS ENUM ('listing', 'auction');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('sale', 'purchase', 'exchange');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('active', 'sold', 'closed');

-- CreateEnum
CREATE TYPE "delivery_service" AS ENUM ('russian-post', 'cdek', 'yandex', 'other');

-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('pending', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "display_name" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "avatar_url" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "rating_sum" INTEGER NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "developer" TEXT NOT NULL DEFAULT '',
    "series" TEXT NOT NULL DEFAULT '',
    "year" INTEGER NOT NULL,
    "genres" TEXT[],
    "description" TEXT NOT NULL,
    "cover_image" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editions" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "lang" TEXT NOT NULL,
    "media" TEXT NOT NULL,
    "release_date" DATE,
    "description" TEXT NOT NULL DEFAULT '',
    "contents" TEXT[],
    "cover_images" TEXT[],
    "barcode" TEXT NOT NULL DEFAULT '',
    "dns_product_id" TEXT NOT NULL DEFAULT '',
    "dns_product_code" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copies" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "edition_id" TEXT NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'Не указано',
    "completeness" TEXT NOT NULL DEFAULT 'Не указано',
    "purchase_price_minor" INTEGER,
    "purchase_date" DATE,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copy_photos" (
    "id" UUID NOT NULL,
    "copy_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "copy_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_entries" (
    "id" TEXT NOT NULL,
    "author_id" UUID NOT NULL,
    "kind" "MarketKind" NOT NULL,
    "listing_type" "ListingType",
    "game_id" TEXT NOT NULL,
    "edition_id" TEXT,
    "title" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "status" "MarketStatus" NOT NULL DEFAULT 'active',
    "delivery_services" "delivery_service"[],
    "international_shipping" BOOLEAN,
    "packaging_price_minor" INTEGER,
    "ships_from" TEXT NOT NULL,
    "bid_step_minor" INTEGER,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "current_price_minor" INTEGER,
    "bid_count" INTEGER NOT NULL DEFAULT 0,
    "winner_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 0,
    "is_seeded" BOOLEAN NOT NULL DEFAULT false,
    "sold_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_photos" (
    "id" UUID NOT NULL,
    "entry_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "market_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bids" (
    "id" UUID NOT NULL,
    "market_entry_id" TEXT NOT NULL,
    "bidder_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "market_entry_id" TEXT NOT NULL,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "status" "DealStatus" NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_display_name_idx" ON "users"("display_name");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "games_title_idx" ON "games"("title");

-- CreateIndex
CREATE INDEX "games_year_idx" ON "games"("year");

-- CreateIndex
CREATE INDEX "editions_game_id_idx" ON "editions"("game_id");

-- CreateIndex
CREATE INDEX "editions_platform_idx" ON "editions"("platform");

-- CreateIndex
CREATE INDEX "editions_region_idx" ON "editions"("region");

-- CreateIndex
CREATE INDEX "editions_lang_idx" ON "editions"("lang");

-- CreateIndex
CREATE INDEX "copies_user_id_edition_id_idx" ON "copies"("user_id", "edition_id");

-- CreateIndex
CREATE INDEX "copies_edition_id_idx" ON "copies"("edition_id");

-- CreateIndex
CREATE INDEX "copy_photos_copy_id_idx" ON "copy_photos"("copy_id");

-- CreateIndex
CREATE INDEX "market_entries_kind_status_created_at_idx" ON "market_entries"("kind", "status", "created_at");

-- CreateIndex
CREATE INDEX "market_entries_author_id_idx" ON "market_entries"("author_id");

-- CreateIndex
CREATE INDEX "market_entries_game_id_idx" ON "market_entries"("game_id");

-- CreateIndex
CREATE INDEX "market_entries_edition_id_idx" ON "market_entries"("edition_id");

-- CreateIndex
CREATE INDEX "market_entries_ends_at_idx" ON "market_entries"("ends_at");

-- CreateIndex
CREATE INDEX "market_photos_entry_id_idx" ON "market_photos"("entry_id");

-- CreateIndex
CREATE INDEX "bids_market_entry_id_amount_minor_idx" ON "bids"("market_entry_id", "amount_minor");

-- CreateIndex
CREATE INDEX "bids_bidder_id_idx" ON "bids"("bidder_id");

-- CreateIndex
CREATE UNIQUE INDEX "deals_market_entry_id_key" ON "deals"("market_entry_id");

-- CreateIndex
CREATE INDEX "deals_buyer_id_idx" ON "deals"("buyer_id");

-- CreateIndex
CREATE INDEX "deals_seller_id_idx" ON "deals"("seller_id");

-- CreateIndex
CREATE INDEX "deals_status_idx" ON "deals"("status");

-- CreateIndex
CREATE INDEX "reviews_target_id_idx" ON "reviews"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_deal_id_author_id_key" ON "reviews"("deal_id", "author_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editions" ADD CONSTRAINT "editions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copies" ADD CONSTRAINT "copies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copies" ADD CONSTRAINT "copies_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "editions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_photos" ADD CONSTRAINT "copy_photos_copy_id_fkey" FOREIGN KEY ("copy_id") REFERENCES "copies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_entries" ADD CONSTRAINT "market_entries_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_entries" ADD CONSTRAINT "market_entries_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_entries" ADD CONSTRAINT "market_entries_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_entries" ADD CONSTRAINT "market_entries_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "editions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_photos" ADD CONSTRAINT "market_photos_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "market_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_market_entry_id_fkey" FOREIGN KEY ("market_entry_id") REFERENCES "market_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bids" ADD CONSTRAINT "bids_bidder_id_fkey" FOREIGN KEY ("bidder_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_market_entry_id_fkey" FOREIGN KEY ("market_entry_id") REFERENCES "market_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
