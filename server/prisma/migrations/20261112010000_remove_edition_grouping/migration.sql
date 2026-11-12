-- Preserve every edition, copy and market reference; only remove grouping.
ALTER TABLE editions DROP CONSTRAINT IF EXISTS editions_canonical_id_fkey;
DROP INDEX IF EXISTS editions_canonical_id_idx;
ALTER TABLE editions DROP COLUMN canonical_id;
