-- Same change as src/db/migrations/20261123000000-add-shift-to-time-entry.ts, to run by hand (dev or prod).
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
-- "TimeEntry"."shiftId": shift chosen when recording the attendance (FK "Shift", ON DELETE RESTRICT).
BEGIN;

ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "shiftId" UUID;
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing rows: link by name within the school when it matches exactly one shift.
UPDATE "TimeEntry" t SET "shiftId" = s."id"
  FROM "Shift" s
 WHERE t."shiftId" IS NULL AND s."schoolId" = t."schoolId" AND s."name" = t."shiftName"
   AND (SELECT COUNT(*) FROM "Shift" x WHERE x."schoolId" = t."schoolId" AND x."name" = t."shiftName") = 1;

CREATE INDEX IF NOT EXISTS "TimeEntry_shiftId_idx" ON "TimeEntry"("shiftId");

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261123000000-add-shift-to-time-entry.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback:
-- DROP INDEX IF EXISTS "TimeEntry_shiftId_idx";
-- ALTER TABLE "TimeEntry" DROP COLUMN IF EXISTS "shiftId";
-- DELETE FROM "SequelizeMeta" WHERE "name" = '20261123000000-add-shift-to-time-entry.ts';
