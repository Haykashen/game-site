-- Replace the provisional rows with the canonical English genre catalogue.
-- The reference table is intentionally standalone, so no game or edition data
-- is touched by this operation.
DELETE FROM "game_genres";

INSERT INTO "game_genres" ("id", "name", "updated_at")
SELECT gen_random_uuid(), name, CURRENT_TIMESTAMP
FROM unnest(ARRAY[
  'Action',
  'Action RPG',
  'Action-adventure',
  'Arcade',
  'Co-op',
  'Dark fantasy',
  'Fighting',
  'Gothic horror',
  'Hack and slash',
  'Horror',
  'MMO',
  'MOBA',
  'Mythology',
  'Online action',
  'Open world',
  'Platformer',
  'Psychological horror',
  'Race',
  'Racing simulator',
  'RPG',
  'Rogue-like',
  'Sci-fi',
  'Shooter',
  'Simulator',
  'Souls-like',
  'Stealth',
  'Strategy',
  'Survival',
  'Survival horror',
  'Vampire-like'
]) AS genres(name)
ON CONFLICT ("name") DO NOTHING;
