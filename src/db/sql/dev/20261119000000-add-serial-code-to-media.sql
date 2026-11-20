-- Same change as src/db/migrations/20261119000000-add-serial-code-to-media.ts, to run by hand (dev or prod).
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
-- media.serial_code = 'RC-' || yyyymmdd (save date) || '-' || 6-digit number from media_serial_code_seq (never repeats).
BEGIN;

CREATE SEQUENCE IF NOT EXISTS media_serial_code_seq MINVALUE 1 MAXVALUE 999999 NO CYCLE;
ALTER TABLE media ADD COLUMN IF NOT EXISTS serial_code VARCHAR(20);

-- Existing rows: numbered by created_at; the sequence continues after them.
WITH numbered AS (SELECT id, row_number() OVER (ORDER BY created_at, id) AS n FROM media)
UPDATE media m
   SET serial_code = 'RC-' || to_char(m.created_at AT TIME ZONE 'America/Lima', 'YYYYMMDD') || '-' || lpad(numbered.n::text, 6, '0')
  FROM numbered
 WHERE m.id = numbered.id AND m.serial_code IS NULL;
SELECT setval('media_serial_code_seq', GREATEST((SELECT COUNT(*) FROM media), 1), (SELECT COUNT(*) FROM media) > 0);

ALTER TABLE media ALTER COLUMN serial_code
  SET DEFAULT 'RC-' || to_char(now() AT TIME ZONE 'America/Lima', 'YYYYMMDD') || '-' || lpad(nextval('media_serial_code_seq')::text, 6, '0');
ALTER TABLE media ALTER COLUMN serial_code SET NOT NULL;
ALTER SEQUENCE media_serial_code_seq OWNED BY media.serial_code;
CREATE UNIQUE INDEX IF NOT EXISTS media_serial_code_key ON media (serial_code);

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261119000000-add-serial-code-to-media.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback (dropping the column also drops the sequence and the index):
-- ALTER TABLE media DROP COLUMN IF EXISTS serial_code;
-- DELETE FROM "SequelizeMeta" WHERE "name" = '20261119000000-add-serial-code-to-media.ts';
