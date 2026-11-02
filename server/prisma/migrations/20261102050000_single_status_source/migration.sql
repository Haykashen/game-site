-- status_id is already backfilled and constrained by the preceding migrations.
-- Fail atomically if any record belongs to the wrong status directory.
BEGIN;
-- Preserve the valid lifecycle codes formerly enforced by enum columns.
ALTER TABLE statuses ADD CONSTRAINT statuses_entity_code_check CHECK (
  (entity::text IN ('Game','Edition','NewsPost','Discussion') AND code IN ('draft','pending','visible','hidden','removed')) OR
  (entity::text IN ('Listing','Auction') AND code IN ('draft','pending','active','rejected','removed','sold','closed')) OR
  (entity::text = 'User' AND code IN ('active','suspended','deleted')) OR
  (entity::text = 'Deal' AND code IN ('pending','completed','cancelled')) OR
  (entity::text = 'Report' AND code IN ('pending','in_review','resolved','dismissed'))
);
CREATE FUNCTION enforce_status_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_entity TEXT;
BEGIN
  owner_entity := TG_ARGV[0];
  IF owner_entity = 'MarketEntry' THEN
    owner_entity := CASE WHEN NEW.kind::text = 'auction' THEN 'Auction' ELSE 'Listing' END;
  END IF;
  IF NEW.status_id IS NULL AND TG_OP = 'INSERT' THEN
    SELECT id INTO NEW.status_id FROM statuses WHERE entity::text = owner_entity AND code = TG_ARGV[1];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM statuses WHERE id = NEW.status_id AND entity::text = owner_entity) THEN
    RAISE EXCEPTION 'Status does not belong to entity %', owner_entity USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER sync_status ON games;
DROP FUNCTION sync_games_status();
CREATE TRIGGER enforce_status_reference BEFORE INSERT OR UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION enforce_status_reference('Game', 'draft');
-- Validate existing rows before dropping the compatibility columns.
UPDATE games SET status_id = status_id;
ALTER TABLE games DROP COLUMN moderation_status;

DROP TRIGGER sync_status ON editions;
DROP FUNCTION sync_editions_status();
CREATE TRIGGER enforce_status_reference BEFORE INSERT OR UPDATE ON editions
  FOR EACH ROW EXECUTE FUNCTION enforce_status_reference('Edition', 'draft');
-- Validate existing rows before dropping the compatibility columns.
UPDATE editions SET status_id = status_id;
ALTER TABLE editions DROP COLUMN moderation_status;

DROP TRIGGER sync_status ON market_entries;
DROP FUNCTION sync_market_entries_status();
CREATE TRIGGER enforce_status_reference BEFORE INSERT OR UPDATE ON market_entries
  FOR EACH ROW EXECUTE FUNCTION enforce_status_reference('MarketEntry', 'pending');
-- Validate existing rows before dropping the compatibility columns.
UPDATE market_entries SET status_id = status_id;
ALTER TABLE market_entries DROP COLUMN status, DROP COLUMN moderation_status;

DROP TRIGGER sync_status ON news_posts;
DROP FUNCTION sync_news_posts_status();
CREATE TRIGGER enforce_status_reference BEFORE INSERT OR UPDATE ON news_posts
  FOR EACH ROW EXECUTE FUNCTION enforce_status_reference('NewsPost', 'pending');
-- Validate existing rows before dropping the compatibility columns.
UPDATE news_posts SET status_id = status_id;
ALTER TABLE news_posts DROP COLUMN moderation_status;

DROP TRIGGER sync_status ON discussions;
DROP FUNCTION sync_discussions_status();
CREATE TRIGGER enforce_status_reference BEFORE INSERT OR UPDATE ON discussions
  FOR EACH ROW EXECUTE FUNCTION enforce_status_reference('Discussion', 'pending');
-- Validate existing rows before dropping the compatibility columns.
UPDATE discussions SET status_id = status_id;
ALTER TABLE discussions DROP COLUMN moderation_status;

DROP TRIGGER sync_status ON users;
DROP FUNCTION sync_users_status();
CREATE TRIGGER enforce_status_reference BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION enforce_status_reference('User', 'active');
-- Validate existing rows before dropping the compatibility columns.
UPDATE users SET status_id = status_id;
ALTER TABLE users DROP COLUMN status;

DROP TRIGGER sync_status ON deals;
DROP FUNCTION sync_deals_status();
CREATE TRIGGER enforce_status_reference BEFORE INSERT OR UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION enforce_status_reference('Deal', 'pending');
-- Validate existing rows before dropping the compatibility columns.
UPDATE deals SET status_id = status_id;
ALTER TABLE deals DROP COLUMN status;

DROP TRIGGER sync_status ON reports;
DROP FUNCTION sync_reports_status();
CREATE TRIGGER enforce_status_reference BEFORE INSERT OR UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION enforce_status_reference('Report', 'pending');
-- Validate existing rows before dropping the compatibility columns.
UPDATE reports SET status_id = status_id;
ALTER TABLE reports DROP COLUMN status;

CREATE INDEX market_entries_kind_status_id_created_at_idx ON market_entries(kind, status_id, created_at);
CREATE INDEX reports_status_id_created_at_idx ON reports(status_id, created_at);
DROP TYPE "MarketStatus";
DROP TYPE "DealStatus";
DROP TYPE "UserStatus";
DROP TYPE "ModerationStatus";
DROP TYPE "ReportStatus";
COMMIT;
