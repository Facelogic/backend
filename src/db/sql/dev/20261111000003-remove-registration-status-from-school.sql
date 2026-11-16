-- Same change as src/db/migrations/20261111000003-remove-registration-status-from-school.ts, to run by hand on the development DB.
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
BEGIN;

ALTER TABLE "School" DROP COLUMN IF EXISTS "registrationStatus";
DROP TYPE IF EXISTS "RegistrationStatus";

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261111000003-remove-registration-status-from-school.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback (every school comes back as COMPLETE; the previous values are lost):
-- CREATE TYPE "RegistrationStatus" AS ENUM ('DRAFT', 'COMPLETE');
-- ALTER TABLE "School" ADD COLUMN "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'COMPLETE';
-- ALTER TABLE "School" ALTER COLUMN "registrationStatus" SET DEFAULT 'DRAFT';
-- DELETE FROM "SequelizeMeta" WHERE "name" = '20261111000003-remove-registration-status-from-school.ts';
