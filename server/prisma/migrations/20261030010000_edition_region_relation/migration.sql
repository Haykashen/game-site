CREATE FUNCTION default_region_id() RETURNS UUID LANGUAGE SQL STABLE AS $$ SELECT id FROM regions WHERE code='EUR' $$;
ALTER TABLE editions ADD COLUMN region_id UUID;
CREATE TEMP TABLE edition_region_mapping AS
SELECT id, CASE
 WHEN lower(btrim(region)) IN ('','не указано','не указан','неизвестно','unknown','n/a','-','null','pal','eu','europe','европа') THEN 'EUR'
 WHEN upper(btrim(region)) IN ('NTSC-J','JP','JAPAN') THEN 'JPN'
 WHEN upper(btrim(region)) IN ('NTSC-U','NTSC-U/C','US') THEN 'USA'
 WHEN upper(btrim(region))='RU' THEN 'RUS'
 ELSE btrim(region) END AS code FROM editions;
INSERT INTO regions (id,code,name,description,created_at,updated_at)
SELECT gen_random_uuid(), mapping.code, mapping.code, 'Перенесено из региона существующего издания',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM (SELECT DISTINCT code FROM edition_region_mapping) mapping
WHERE NOT EXISTS (SELECT 1 FROM regions r WHERE lower(r.code)=lower(mapping.code) OR lower(r.name)=lower(mapping.code));
UPDATE editions e SET region_id=r.id FROM edition_region_mapping m JOIN regions r ON lower(r.code)=lower(m.code) OR lower(r.name)=lower(m.code) WHERE e.id=m.id;
UPDATE editions SET region_id=default_region_id() WHERE region_id IS NULL;
ALTER TABLE editions ALTER COLUMN region_id SET DEFAULT default_region_id();
ALTER TABLE editions ALTER COLUMN region_id SET NOT NULL;
ALTER TABLE editions ADD CONSTRAINT editions_region_id_fkey FOREIGN KEY(region_id) REFERENCES regions(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX editions_region_id_idx ON editions(region_id);
DROP INDEX IF EXISTS editions_region_idx;
ALTER TABLE editions DROP COLUMN region;
DROP TABLE edition_region_mapping;
