-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
    'bid_placed',
    'bid_outbid',
    'auction_won',
    'auction_lost',
    'auction_sold',
    'auction_closed',
    'entry_created',
    'entry_sold',
    'entry_closed',
    'entry_reopened',
    'entry_price_changed',
    'deal_created'
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "market_entry_id" TEXT,
    "game_id" TEXT,
    "actor_id" UUID,
    "dedupe_key" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "game_id" TEXT NOT NULL,
    "notify_auctions" BOOLEAN NOT NULL DEFAULT true,
    "notify_listings" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_entry_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "market_entry_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_entry_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_market_entry_id_idx" ON "notifications"("market_entry_id");

-- CreateIndex
CREATE INDEX "notifications_game_id_idx" ON "notifications"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_subscriptions_user_id_game_id_key" ON "game_subscriptions"("user_id", "game_id");

-- CreateIndex
CREATE INDEX "game_subscriptions_game_id_idx" ON "game_subscriptions"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "market_entry_subscriptions_user_id_market_entry_id_key" ON "market_entry_subscriptions"("user_id", "market_entry_id");

-- CreateIndex
CREATE INDEX "market_entry_subscriptions_market_entry_id_idx" ON "market_entry_subscriptions"("market_entry_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_market_entry_id_fkey" FOREIGN KEY ("market_entry_id") REFERENCES "market_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_subscriptions" ADD CONSTRAINT "game_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_subscriptions" ADD CONSTRAINT "game_subscriptions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_entry_subscriptions" ADD CONSTRAINT "market_entry_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_entry_subscriptions" ADD CONSTRAINT "market_entry_subscriptions_market_entry_id_fkey" FOREIGN KEY ("market_entry_id") REFERENCES "market_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
