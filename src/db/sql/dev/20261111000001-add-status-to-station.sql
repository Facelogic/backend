-- Same change as src/db/migrations/20261111000001-add-status-to-station.ts, to run by hand on the development DB.
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
BEGIN;

ALTER TABLE "Station" ADD COLUMN IF NOT EXISTS "status" SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE "Station" DROP CONSTRAINT IF EXISTS "Station_status_check";
ALTER TABLE "Station" ADD CONSTRAINT "Station_status_check" CHECK ("status" IN (0, 1));

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261111000001-add-status-to-station.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback:
-- ALTER TABLE "Station" DROP COLUMN IF EXISTS "status";
-- DELETE FROM "SequelizeMeta" WHERE "name" = '20261111000001-add-status-to-station.ts';
