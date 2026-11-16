-- Same change as src/db/migrations/20261115000000-add-school-to-media.ts, to run by hand on the development DB.
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
-- media.school_id is NOT NULL: if the table already has rows, assign them a school (or delete them) first.
BEGIN;

ALTER TABLE media ADD COLUMN IF NOT EXISTS school_id UUID;
-- UPDATE media SET school_id = '<school-uuid>' WHERE school_id IS NULL;
ALTER TABLE media ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE media DROP CONSTRAINT IF EXISTS media_school_id_fkey;
ALTER TABLE media ADD CONSTRAINT media_school_id_fkey
  FOREIGN KEY (school_id) REFERENCES "School"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS media_school_id_created_at ON media (school_id, created_at);

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261115000000-add-school-to-media.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback:
-- ALTER TABLE media DROP COLUMN IF EXISTS school_id;
-- DELETE FROM "SequelizeMeta" WHERE "name" = '20261115000000-add-school-to-media.ts';
