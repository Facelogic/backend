-- Same change as src/db/migrations/20261111000002-add-position-to-user.ts, to run by hand on the development DB.
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
BEGIN;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "position" VARCHAR(80);

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261111000002-add-position-to-user.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback:
-- ALTER TABLE "User" DROP COLUMN IF EXISTS "position";
-- DELETE FROM "SequelizeMeta" WHERE "name" = '20261111000002-add-position-to-user.ts';
