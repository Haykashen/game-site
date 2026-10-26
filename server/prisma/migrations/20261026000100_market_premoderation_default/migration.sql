-- Keep the new enum value out of the previous migration transaction.
ALTER TABLE "market_entries"
ALTER COLUMN "moderation_status" SET DEFAULT 'pending';
