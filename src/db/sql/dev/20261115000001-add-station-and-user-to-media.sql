-- Same change as src/db/migrations/20261115000001-add-station-and-user-to-media.ts, to run by hand on the development DB.
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
-- media.owner_id becomes NOT NULL: rows without a valid owner must be fixed (or deleted) first.
BEGIN;

-- UPDATE media SET owner_id = '<user-uuid>'
--   WHERE owner_id IS NULL OR NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = media.owner_id);
ALTER TABLE media ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE media DROP CONSTRAINT IF EXISTS media_owner_id_fkey;
ALTER TABLE media ADD CONSTRAINT media_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE media ADD COLUMN IF NOT EXISTS station_id UUID;
ALTER TABLE media DROP CONSTRAINT IF EXISTS media_station_id_fkey;
ALTER TABLE media ADD CONSTRAINT media_station_id_fkey
  FOREIGN KEY (station_id) REFERENCES "Station"(id) ON UPDATE CASCADE ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS media_station_id_created_at ON media (station_id, created_at);

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261115000001-add-station-and-user-to-media.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback:
-- ALTER TABLE media DROP COLUMN IF EXISTS station_id;
-- ALTER TABLE media DROP CONSTRAINT IF EXISTS media_owner_id_fkey;
-- ALTER TABLE media ALTER COLUMN owner_id DROP NOT NULL;
-- DELETE FROM "SequelizeMeta" WHERE "name" = '20261115000001-add-station-and-user-to-media.ts';
