BEGIN;
CREATE FUNCTION normalize_edition_language(value TEXT) RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT coalesce(string_agg(upper(left(token, 1)) || substr(token, 2), ', ' ORDER BY token COLLATE "C"), 'Не указано')
  FROM (
    SELECT DISTINCT btrim(regexp_replace(lower(part), '[[:space:]]+', ' ', 'g')) AS token
    FROM regexp_split_to_table(coalesce(value, ''), '[,;]') AS part
  ) AS tokens
  WHERE token NOT IN ('', 'не указан', 'не указано', 'неизвестно', 'unknown', 'n/a', '-');
$$;
CREATE FUNCTION enforce_edition_language() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.lang := normalize_edition_language(NEW.lang);
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_edition_language BEFORE INSERT OR UPDATE OF lang ON editions
  FOR EACH ROW EXECUTE FUNCTION enforce_edition_language();
-- Preserve every edition ID, image, status and foreign-key reference.
UPDATE editions SET lang = normalize_edition_language(lang)
  WHERE lang IS DISTINCT FROM normalize_edition_language(lang);
COMMIT;
