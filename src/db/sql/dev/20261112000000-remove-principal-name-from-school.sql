-- Same change as src/db/migrations/20261112000000-remove-principal-name-from-school.ts, to run by hand on the development DB.
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
BEGIN;

ALTER TABLE "School" DROP COLUMN IF EXISTS "principalName";

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261112000000-remove-principal-name-from-school.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback (the column comes back empty; the previous values are lost):
-- ALTER TABLE "School" ADD COLUMN "principalName" VARCHAR(120);
-- DELETE FROM "SequelizeMeta" WHERE "name" = '20261112000000-remove-principal-name-from-school.ts';
