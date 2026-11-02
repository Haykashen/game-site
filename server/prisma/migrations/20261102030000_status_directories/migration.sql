-- Status directories are authoritative; legacy columns remain synchronized for API compatibility.
CREATE TABLE "game_statuses" (id UUID PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL);
INSERT INTO "game_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('game_statuses:draft')::uuid,'draft','Черновик',0,CURRENT_TIMESTAMP);
INSERT INTO "game_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('game_statuses:pending')::uuid,'pending','На проверке',1,CURRENT_TIMESTAMP);
INSERT INTO "game_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('game_statuses:visible')::uuid,'visible','Проверено',2,CURRENT_TIMESTAMP);
INSERT INTO "game_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('game_statuses:hidden')::uuid,'hidden','Отклонено',3,CURRENT_TIMESTAMP);
INSERT INTO "game_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('game_statuses:removed')::uuid,'removed','Снято с публикации',4,CURRENT_TIMESTAMP);
ALTER TABLE "games" ADD COLUMN status_id UUID;
CREATE FUNCTION sync_games_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT;
BEGIN
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM "game_statuses" WHERE id=NEW.status_id;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Unknown status' USING ERRCODE='23503'; END IF;
    NEW.moderation_status := chosen::"ModerationStatus";
  ELSE
    chosen := NEW.moderation_status::text;
    SELECT id INTO NEW.status_id FROM "game_statuses" WHERE code=chosen;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON "games" FOR EACH ROW EXECUTE FUNCTION sync_games_status();
UPDATE "games" SET status_id=NULL;
ALTER TABLE "games" ALTER COLUMN status_id SET NOT NULL;
ALTER TABLE "games" ADD CONSTRAINT "games_status_id_fkey" FOREIGN KEY(status_id) REFERENCES "game_statuses"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "games_status_id_idx" ON "games"(status_id);
ALTER TABLE "editions" ADD COLUMN status_id UUID;
CREATE FUNCTION sync_editions_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT;
BEGIN
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM "game_statuses" WHERE id=NEW.status_id;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Unknown status' USING ERRCODE='23503'; END IF;
    NEW.moderation_status := chosen::"ModerationStatus";
  ELSE
    chosen := NEW.moderation_status::text;
    SELECT id INTO NEW.status_id FROM "game_statuses" WHERE code=chosen;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON "editions" FOR EACH ROW EXECUTE FUNCTION sync_editions_status();
UPDATE "editions" SET status_id=NULL;
ALTER TABLE "editions" ALTER COLUMN status_id SET NOT NULL;
ALTER TABLE "editions" ADD CONSTRAINT "editions_status_id_fkey" FOREIGN KEY(status_id) REFERENCES "game_statuses"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "editions_status_id_idx" ON "editions"(status_id);
CREATE TABLE "market_entry_statuses" (id UUID PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL);
INSERT INTO "market_entry_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('market_entry_statuses:draft')::uuid,'draft','Черновик',0,CURRENT_TIMESTAMP);
INSERT INTO "market_entry_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('market_entry_statuses:pending')::uuid,'pending','На проверке',1,CURRENT_TIMESTAMP);
INSERT INTO "market_entry_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('market_entry_statuses:active')::uuid,'active','Активно',2,CURRENT_TIMESTAMP);
INSERT INTO "market_entry_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('market_entry_statuses:rejected')::uuid,'rejected','Отклонено',3,CURRENT_TIMESTAMP);
INSERT INTO "market_entry_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('market_entry_statuses:sold')::uuid,'sold','Продано',4,CURRENT_TIMESTAMP);
INSERT INTO "market_entry_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('market_entry_statuses:closed')::uuid,'closed','Закрыто',5,CURRENT_TIMESTAMP);
INSERT INTO "market_entry_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('market_entry_statuses:removed')::uuid,'removed','Удалено',6,CURRENT_TIMESTAMP);
ALTER TABLE "market_entries" ADD COLUMN status_id UUID;
CREATE FUNCTION sync_market_entries_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT;
BEGIN
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM "market_entry_statuses" WHERE id=NEW.status_id;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Unknown status' USING ERRCODE='23503'; END IF;
    NEW.status := (CASE WHEN chosen='sold' THEN 'sold' WHEN chosen='closed' THEN 'closed' ELSE 'active' END)::"MarketStatus"; NEW.moderation_status := (CASE WHEN chosen IN ('active','sold','closed') THEN 'visible' WHEN chosen='rejected' THEN 'hidden' ELSE chosen END)::"ModerationStatus";
  ELSE
    chosen := CASE WHEN NEW.status::text='sold' THEN 'sold' WHEN NEW.status::text='closed' THEN 'closed' WHEN NEW.moderation_status::text='visible' THEN 'active' WHEN NEW.moderation_status::text='hidden' THEN 'rejected' ELSE NEW.moderation_status::text END;
    SELECT id INTO NEW.status_id FROM "market_entry_statuses" WHERE code=chosen;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON "market_entries" FOR EACH ROW EXECUTE FUNCTION sync_market_entries_status();
UPDATE "market_entries" SET status_id=NULL;
ALTER TABLE "market_entries" ALTER COLUMN status_id SET NOT NULL;
ALTER TABLE "market_entries" ADD CONSTRAINT "market_entries_status_id_fkey" FOREIGN KEY(status_id) REFERENCES "market_entry_statuses"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "market_entries_status_id_idx" ON "market_entries"(status_id);
CREATE TABLE "content_statuses" (id UUID PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL);
INSERT INTO "content_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('content_statuses:draft')::uuid,'draft','Черновик',0,CURRENT_TIMESTAMP);
INSERT INTO "content_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('content_statuses:pending')::uuid,'pending','На проверке',1,CURRENT_TIMESTAMP);
INSERT INTO "content_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('content_statuses:visible')::uuid,'visible','Опубликовано',2,CURRENT_TIMESTAMP);
INSERT INTO "content_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('content_statuses:hidden')::uuid,'hidden','Отклонено',3,CURRENT_TIMESTAMP);
INSERT INTO "content_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('content_statuses:removed')::uuid,'removed','Снято с публикации',4,CURRENT_TIMESTAMP);
ALTER TABLE "news_posts" ADD COLUMN status_id UUID;
CREATE FUNCTION sync_news_posts_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT;
BEGIN
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM "content_statuses" WHERE id=NEW.status_id;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Unknown status' USING ERRCODE='23503'; END IF;
    NEW.moderation_status := chosen::"ModerationStatus";
  ELSE
    chosen := NEW.moderation_status::text;
    SELECT id INTO NEW.status_id FROM "content_statuses" WHERE code=chosen;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON "news_posts" FOR EACH ROW EXECUTE FUNCTION sync_news_posts_status();
UPDATE "news_posts" SET status_id=NULL;
ALTER TABLE "news_posts" ALTER COLUMN status_id SET NOT NULL;
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_status_id_fkey" FOREIGN KEY(status_id) REFERENCES "content_statuses"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "news_posts_status_id_idx" ON "news_posts"(status_id);
ALTER TABLE "discussions" ADD COLUMN status_id UUID;
CREATE FUNCTION sync_discussions_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT;
BEGIN
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM "content_statuses" WHERE id=NEW.status_id;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Unknown status' USING ERRCODE='23503'; END IF;
    NEW.moderation_status := chosen::"ModerationStatus";
  ELSE
    chosen := NEW.moderation_status::text;
    SELECT id INTO NEW.status_id FROM "content_statuses" WHERE code=chosen;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON "discussions" FOR EACH ROW EXECUTE FUNCTION sync_discussions_status();
UPDATE "discussions" SET status_id=NULL;
ALTER TABLE "discussions" ALTER COLUMN status_id SET NOT NULL;
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_status_id_fkey" FOREIGN KEY(status_id) REFERENCES "content_statuses"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "discussions_status_id_idx" ON "discussions"(status_id);
CREATE TABLE "account_statuses" (id UUID PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL);
INSERT INTO "account_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('account_statuses:active')::uuid,'active','Активен',0,CURRENT_TIMESTAMP);
INSERT INTO "account_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('account_statuses:suspended')::uuid,'suspended','Заблокирован',1,CURRENT_TIMESTAMP);
INSERT INTO "account_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('account_statuses:deleted')::uuid,'deleted','Удалён',2,CURRENT_TIMESTAMP);
ALTER TABLE "users" ADD COLUMN status_id UUID;
CREATE FUNCTION sync_users_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT;
BEGIN
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM "account_statuses" WHERE id=NEW.status_id;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Unknown status' USING ERRCODE='23503'; END IF;
    NEW.status := chosen::"UserStatus";
  ELSE
    chosen := NEW.status::text;
    SELECT id INTO NEW.status_id FROM "account_statuses" WHERE code=chosen;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION sync_users_status();
UPDATE "users" SET status_id=NULL;
ALTER TABLE "users" ALTER COLUMN status_id SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_status_id_fkey" FOREIGN KEY(status_id) REFERENCES "account_statuses"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "users_status_id_idx" ON "users"(status_id);
CREATE TABLE "transaction_statuses" (id UUID PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL);
INSERT INTO "transaction_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('transaction_statuses:pending')::uuid,'pending','Ожидает',0,CURRENT_TIMESTAMP);
INSERT INTO "transaction_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('transaction_statuses:completed')::uuid,'completed','Завершена',1,CURRENT_TIMESTAMP);
INSERT INTO "transaction_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('transaction_statuses:cancelled')::uuid,'cancelled','Отменена',2,CURRENT_TIMESTAMP);
ALTER TABLE "deals" ADD COLUMN status_id UUID;
CREATE FUNCTION sync_deals_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT;
BEGIN
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM "transaction_statuses" WHERE id=NEW.status_id;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Unknown status' USING ERRCODE='23503'; END IF;
    NEW.status := chosen::"DealStatus";
  ELSE
    chosen := NEW.status::text;
    SELECT id INTO NEW.status_id FROM "transaction_statuses" WHERE code=chosen;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON "deals" FOR EACH ROW EXECUTE FUNCTION sync_deals_status();
UPDATE "deals" SET status_id=NULL;
ALTER TABLE "deals" ALTER COLUMN status_id SET NOT NULL;
ALTER TABLE "deals" ADD CONSTRAINT "deals_status_id_fkey" FOREIGN KEY(status_id) REFERENCES "transaction_statuses"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "deals_status_id_idx" ON "deals"(status_id);
CREATE TABLE "complaint_statuses" (id UUID PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL);
INSERT INTO "complaint_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('complaint_statuses:pending')::uuid,'pending','На рассмотрении',0,CURRENT_TIMESTAMP);
INSERT INTO "complaint_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('complaint_statuses:in_review')::uuid,'in_review','В работе',1,CURRENT_TIMESTAMP);
INSERT INTO "complaint_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('complaint_statuses:resolved')::uuid,'resolved','Решена',2,CURRENT_TIMESTAMP);
INSERT INTO "complaint_statuses" (id,code,name,sort_order,updated_at) VALUES (md5('complaint_statuses:dismissed')::uuid,'dismissed','Отклонена',3,CURRENT_TIMESTAMP);
ALTER TABLE "reports" ADD COLUMN status_id UUID;
CREATE FUNCTION sync_reports_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE chosen TEXT;
BEGIN
  IF (TG_OP='INSERT' AND NEW.status_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.status_id IS DISTINCT FROM OLD.status_id) THEN
    SELECT code INTO chosen FROM "complaint_statuses" WHERE id=NEW.status_id;
    IF chosen IS NULL THEN RAISE EXCEPTION 'Unknown status' USING ERRCODE='23503'; END IF;
    NEW.status := chosen::"ReportStatus";
  ELSE
    chosen := NEW.status::text;
    SELECT id INTO NEW.status_id FROM "complaint_statuses" WHERE code=chosen;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_status BEFORE INSERT OR UPDATE ON "reports" FOR EACH ROW EXECUTE FUNCTION sync_reports_status();
UPDATE "reports" SET status_id=NULL;
ALTER TABLE "reports" ALTER COLUMN status_id SET NOT NULL;
ALTER TABLE "reports" ADD CONSTRAINT "reports_status_id_fkey" FOREIGN KEY(status_id) REFERENCES "complaint_statuses"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "reports_status_id_idx" ON "reports"(status_id);
