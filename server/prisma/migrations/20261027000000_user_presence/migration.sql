ALTER TABLE "users" ADD COLUMN "last_seen_at" TIMESTAMP(3);

-- Preserve the activity history available in existing sessions.
UPDATE "users" AS u
SET "last_seen_at" = activity.last_seen_at
FROM (
  SELECT "user_id", MAX("last_used_at") AS last_seen_at
  FROM "sessions"
  GROUP BY "user_id"
) AS activity
WHERE u."id" = activity."user_id";
