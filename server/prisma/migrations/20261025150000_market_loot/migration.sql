CREATE TYPE "MarketItemType" AS ENUM ('game', 'cover', 'manual', 'map', 'soundtrack', 'figure', 'steelbook', 'other');
ALTER TABLE "market_entries" ADD COLUMN "item_type" "MarketItemType" NOT NULL DEFAULT 'game';
