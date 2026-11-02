CREATE TYPE "StatusEntity" AS ENUM ('Game','Edition','Listing','Auction','NewsPost','Discussion','User','Deal','Report');
CREATE TABLE statuses (id UUID PRIMARY KEY, entity "StatusEntity" NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL);
CREATE UNIQUE INDEX statuses_entity_code_key ON statuses(entity,code);
INSERT INTO statuses(id,entity,code,name,description,sort_order,created_at,updated_at) SELECT md5('Game:'||code)::uuid,'Game',code,name,description,sort_order,created_at,updated_at FROM game_statuses;
DROP TRIGGER sync_status ON games;
ALTER TABLE games DROP CONSTRAINT games_status_id_fkey;
UPDATE games AS source SET status_id=target.id FROM game_statuses AS old, statuses AS target WHERE source.status_id=old.id AND target.code=old.code AND target.entity::text=('Game');
ALTER TABLE games ADD CONSTRAINT games_status_id_fkey FOREIGN KEY(status_id) REFERENCES statuses(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION sync_games_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT; owner_entity TEXT;
BEGIN
  owner_entity := 'Game';
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM statuses WHERE id=NEW.status_id AND entity::text=owner_entity;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Status does not belong to entity %',owner_entity USING ERRCODE='23503'; END IF;
    NEW.moderation_status := chosen::"ModerationStatus";
  ELSE
    chosen := NEW.moderation_status::text;
    SELECT id INTO NEW.status_id FROM statuses WHERE code=chosen AND entity::text=owner_entity;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON games FOR EACH ROW EXECUTE FUNCTION sync_games_status();
INSERT INTO statuses(id,entity,code,name,description,sort_order,created_at,updated_at) SELECT md5('Edition:'||code)::uuid,'Edition',code,name,description,sort_order,created_at,updated_at FROM game_statuses;
DROP TRIGGER sync_status ON editions;
ALTER TABLE editions DROP CONSTRAINT editions_status_id_fkey;
UPDATE editions AS source SET status_id=target.id FROM game_statuses AS old, statuses AS target WHERE source.status_id=old.id AND target.code=old.code AND target.entity::text=('Edition');
ALTER TABLE editions ADD CONSTRAINT editions_status_id_fkey FOREIGN KEY(status_id) REFERENCES statuses(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION sync_editions_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT; owner_entity TEXT;
BEGIN
  owner_entity := 'Edition';
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM statuses WHERE id=NEW.status_id AND entity::text=owner_entity;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Status does not belong to entity %',owner_entity USING ERRCODE='23503'; END IF;
    NEW.moderation_status := chosen::"ModerationStatus";
  ELSE
    chosen := NEW.moderation_status::text;
    SELECT id INTO NEW.status_id FROM statuses WHERE code=chosen AND entity::text=owner_entity;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON editions FOR EACH ROW EXECUTE FUNCTION sync_editions_status();
INSERT INTO statuses(id,entity,code,name,description,sort_order,created_at,updated_at) SELECT md5('Listing:'||code)::uuid,'Listing',code,name,description,sort_order,created_at,updated_at FROM market_entry_statuses;
INSERT INTO statuses(id,entity,code,name,description,sort_order,created_at,updated_at) SELECT md5('Auction:'||code)::uuid,'Auction',code,name,description,sort_order,created_at,updated_at FROM market_entry_statuses;
DROP TRIGGER sync_status ON market_entries;
ALTER TABLE market_entries DROP CONSTRAINT market_entries_status_id_fkey;
UPDATE market_entries AS source SET status_id=target.id FROM market_entry_statuses AS old, statuses AS target WHERE source.status_id=old.id AND target.code=old.code AND target.entity::text=(CASE WHEN source.kind::text='auction' THEN 'Auction' ELSE 'Listing' END);
ALTER TABLE market_entries ADD CONSTRAINT market_entries_status_id_fkey FOREIGN KEY(status_id) REFERENCES statuses(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION sync_market_entries_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT; owner_entity TEXT;
BEGIN
  owner_entity := CASE WHEN NEW.kind::text='auction' THEN 'Auction' ELSE 'Listing' END;
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM statuses WHERE id=NEW.status_id AND entity::text=owner_entity;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Status does not belong to entity %',owner_entity USING ERRCODE='23503'; END IF;
    NEW.status := (CASE WHEN chosen='sold' THEN 'sold' WHEN chosen='closed' THEN 'closed' ELSE 'active' END)::"MarketStatus"; NEW.moderation_status := (CASE WHEN chosen IN ('active','sold','closed') THEN 'visible' WHEN chosen='rejected' THEN 'hidden' ELSE chosen END)::"ModerationStatus";
  ELSE
    chosen := CASE WHEN NEW.status::text='sold' THEN 'sold' WHEN NEW.status::text='closed' THEN 'closed' WHEN NEW.moderation_status::text='visible' THEN 'active' WHEN NEW.moderation_status::text='hidden' THEN 'rejected' ELSE NEW.moderation_status::text END;
    SELECT id INTO NEW.status_id FROM statuses WHERE code=chosen AND entity::text=owner_entity;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON market_entries FOR EACH ROW EXECUTE FUNCTION sync_market_entries_status();
INSERT INTO statuses(id,entity,code,name,description,sort_order,created_at,updated_at) SELECT md5('NewsPost:'||code)::uuid,'NewsPost',code,name,description,sort_order,created_at,updated_at FROM content_statuses;
DROP TRIGGER sync_status ON news_posts;
ALTER TABLE news_posts DROP CONSTRAINT news_posts_status_id_fkey;
UPDATE news_posts AS source SET status_id=target.id FROM content_statuses AS old, statuses AS target WHERE source.status_id=old.id AND target.code=old.code AND target.entity::text=('NewsPost');
ALTER TABLE news_posts ADD CONSTRAINT news_posts_status_id_fkey FOREIGN KEY(status_id) REFERENCES statuses(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION sync_news_posts_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT; owner_entity TEXT;
BEGIN
  owner_entity := 'NewsPost';
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM statuses WHERE id=NEW.status_id AND entity::text=owner_entity;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Status does not belong to entity %',owner_entity USING ERRCODE='23503'; END IF;
    NEW.moderation_status := chosen::"ModerationStatus";
  ELSE
    chosen := NEW.moderation_status::text;
    SELECT id INTO NEW.status_id FROM statuses WHERE code=chosen AND entity::text=owner_entity;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON news_posts FOR EACH ROW EXECUTE FUNCTION sync_news_posts_status();
INSERT INTO statuses(id,entity,code,name,description,sort_order,created_at,updated_at) SELECT md5('Discussion:'||code)::uuid,'Discussion',code,name,description,sort_order,created_at,updated_at FROM content_statuses;
DROP TRIGGER sync_status ON discussions;
ALTER TABLE discussions DROP CONSTRAINT discussions_status_id_fkey;
UPDATE discussions AS source SET status_id=target.id FROM content_statuses AS old, statuses AS target WHERE source.status_id=old.id AND target.code=old.code AND target.entity::text=('Discussion');
ALTER TABLE discussions ADD CONSTRAINT discussions_status_id_fkey FOREIGN KEY(status_id) REFERENCES statuses(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION sync_discussions_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT; owner_entity TEXT;
BEGIN
  owner_entity := 'Discussion';
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM statuses WHERE id=NEW.status_id AND entity::text=owner_entity;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Status does not belong to entity %',owner_entity USING ERRCODE='23503'; END IF;
    NEW.moderation_status := chosen::"ModerationStatus";
  ELSE
    chosen := NEW.moderation_status::text;
    SELECT id INTO NEW.status_id FROM statuses WHERE code=chosen AND entity::text=owner_entity;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON discussions FOR EACH ROW EXECUTE FUNCTION sync_discussions_status();
INSERT INTO statuses(id,entity,code,name,description,sort_order,created_at,updated_at) SELECT md5('User:'||code)::uuid,'User',code,name,description,sort_order,created_at,updated_at FROM account_statuses;
DROP TRIGGER sync_status ON users;
ALTER TABLE users DROP CONSTRAINT users_status_id_fkey;
UPDATE users AS source SET status_id=target.id FROM account_statuses AS old, statuses AS target WHERE source.status_id=old.id AND target.code=old.code AND target.entity::text=('User');
ALTER TABLE users ADD CONSTRAINT users_status_id_fkey FOREIGN KEY(status_id) REFERENCES statuses(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION sync_users_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT; owner_entity TEXT;
BEGIN
  owner_entity := 'User';
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM statuses WHERE id=NEW.status_id AND entity::text=owner_entity;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Status does not belong to entity %',owner_entity USING ERRCODE='23503'; END IF;
    NEW.status := chosen::"UserStatus";
  ELSE
    chosen := NEW.status::text;
    SELECT id INTO NEW.status_id FROM statuses WHERE code=chosen AND entity::text=owner_entity;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION sync_users_status();
INSERT INTO statuses(id,entity,code,name,description,sort_order,created_at,updated_at) SELECT md5('Deal:'||code)::uuid,'Deal',code,name,description,sort_order,created_at,updated_at FROM transaction_statuses;
DROP TRIGGER sync_status ON deals;
ALTER TABLE deals DROP CONSTRAINT deals_status_id_fkey;
UPDATE deals AS source SET status_id=target.id FROM transaction_statuses AS old, statuses AS target WHERE source.status_id=old.id AND target.code=old.code AND target.entity::text=('Deal');
ALTER TABLE deals ADD CONSTRAINT deals_status_id_fkey FOREIGN KEY(status_id) REFERENCES statuses(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION sync_deals_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT; owner_entity TEXT;
BEGIN
  owner_entity := 'Deal';
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM statuses WHERE id=NEW.status_id AND entity::text=owner_entity;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Status does not belong to entity %',owner_entity USING ERRCODE='23503'; END IF;
    NEW.status := chosen::"DealStatus";
  ELSE
    chosen := NEW.status::text;
    SELECT id INTO NEW.status_id FROM statuses WHERE code=chosen AND entity::text=owner_entity;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION sync_deals_status();
INSERT INTO statuses(id,entity,code,name,description,sort_order,created_at,updated_at) SELECT md5('Report:'||code)::uuid,'Report',code,name,description,sort_order,created_at,updated_at FROM complaint_statuses;
DROP TRIGGER sync_status ON reports;
ALTER TABLE reports DROP CONSTRAINT reports_status_id_fkey;
UPDATE reports AS source SET status_id=target.id FROM complaint_statuses AS old, statuses AS target WHERE source.status_id=old.id AND target.code=old.code AND target.entity::text=('Report');
ALTER TABLE reports ADD CONSTRAINT reports_status_id_fkey FOREIGN KEY(status_id) REFERENCES statuses(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION sync_reports_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT; owner_entity TEXT;
BEGIN
  owner_entity := 'Report';
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM statuses WHERE id=NEW.status_id AND entity::text=owner_entity;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Status does not belong to entity %',owner_entity USING ERRCODE='23503'; END IF;
    NEW.status := chosen::"ReportStatus";
  ELSE
    chosen := NEW.status::text;
    SELECT id INTO NEW.status_id FROM statuses WHERE code=chosen AND entity::text=owner_entity;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION sync_reports_status();
DROP TABLE game_statuses;
DROP TABLE market_entry_statuses;
DROP TABLE content_statuses;
DROP TABLE account_statuses;
DROP TABLE transaction_statuses;
DROP TABLE complaint_statuses;
CREATE FUNCTION protect_status_identity() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.code IS DISTINCT FROM OLD.code OR NEW.entity IS DISTINCT FROM OLD.entity OR NEW.id IS DISTINCT FROM OLD.id THEN RAISE EXCEPTION 'System status identity cannot change' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER protect_status_identity BEFORE UPDATE ON statuses FOR EACH ROW EXECUTE FUNCTION protect_status_identity();
