-- Same change as src/db/migrations/20261111000000-add-phone-to-school.ts, to run by hand on the development DB.
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
BEGIN;

ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(15);

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261111000000-add-phone-to-school.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback:
-- ALTER TABLE "School" DROP COLUMN IF EXISTS "phone";
-- DELETE FROM "SequelizeMeta" WHERE "name" = '20261111000000-add-phone-to-school.ts';
