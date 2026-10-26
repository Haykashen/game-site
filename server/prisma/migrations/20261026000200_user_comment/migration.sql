-- Administrators need a general comment column for accounts. The previous
-- suspension reason is the same moderation note, so keep its data.
ALTER TABLE "users" RENAME COLUMN "suspension_reason" TO "comment";
