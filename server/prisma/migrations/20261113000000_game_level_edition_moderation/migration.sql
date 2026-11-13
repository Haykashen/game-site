-- Edition visibility now follows the game. Do not remove editions or owned copies.
DROP TRIGGER IF EXISTS enforce_status_reference ON editions;
DROP TRIGGER IF EXISTS enforce_edition_language ON editions;
DROP FUNCTION IF EXISTS enforce_edition_language();
ALTER TABLE editions DROP CONSTRAINT IF EXISTS editions_status_id_fkey;
ALTER TABLE editions DROP COLUMN status_id, DROP COLUMN moderation_note, DROP COLUMN moderated_at, DROP COLUMN moderator_id, DROP COLUMN lang;
DELETE FROM statuses WHERE entity='Edition';
