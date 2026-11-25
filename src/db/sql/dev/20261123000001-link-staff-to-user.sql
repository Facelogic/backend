-- Same change as src/db/migrations/20261123000001-link-staff-to-user.ts, to run by hand (dev or prod).
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
-- "Staff" now points to its "User" ("userId", unique, FK ON DELETE RESTRICT); school, name, document, email and
-- position live only in "User". Existing rows are linked by email or document within the same school.
BEGIN;

ALTER TABLE "Staff" ADD COLUMN IF NOT EXISTS "userId" UUID;

UPDATE "Staff" s SET "userId" = (
    SELECT u."id" FROM "User" u
     WHERE u."schoolId" = s."schoolId"
       AND ((s."email" IS NOT NULL AND LOWER(u."email") = LOWER(s."email")) OR u."document" = s."nationalId")
     ORDER BY (s."email" IS NOT NULL AND LOWER(u."email") = LOWER(s."email")) DESC
     LIMIT 1)
 WHERE s."userId" IS NULL;

UPDATE "User" u SET "position" = s."position"
  FROM "Staff" s
 WHERE s."userId" = u."id" AND u."position" IS NULL;

-- Fails (and the transaction is rolled back) if any staff row couldn't be linked to a user.
ALTER TABLE "Staff" ALTER COLUMN "userId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Staff_userId_key" ON "Staff"("userId");
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Staff_schoolId_nationalId_key";
ALTER TABLE "Staff" DROP COLUMN IF EXISTS "nationalId";
ALTER TABLE "Staff" DROP COLUMN IF EXISTS "name";
ALTER TABLE "Staff" DROP COLUMN IF EXISTS "email";
ALTER TABLE "Staff" DROP COLUMN IF EXISTS "position";
ALTER TABLE "Staff" DROP CONSTRAINT IF EXISTS "Staff_schoolId_fkey";
ALTER TABLE "Staff" DROP COLUMN IF EXISTS "schoolId";

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261123000001-link-staff-to-user.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback: use `npm run db:migrate:undo` (it restores the columns copying the data back from "User").
