-- Same change as src/db/migrations/20261124000000-add-school-to-classroom-schedule.ts, to run by hand (dev or prod).
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
-- "ClassroomSchedule"."schoolId": the classroom and the schedule of each link must belong to the same school
-- (two composite FKs sharing "schoolId"). Run it after 20261123000003-create-classroom-schedule.sql.
BEGIN;

ALTER TABLE "ClassroomSchedule" ADD COLUMN IF NOT EXISTS "schoolId" UUID;
UPDATE "ClassroomSchedule" cs SET "schoolId" = c."schoolId" FROM "Classroom" c WHERE c."id" = cs."classroomId" AND cs."schoolId" IS NULL;
ALTER TABLE "ClassroomSchedule" ALTER COLUMN "schoolId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Classroom_id_schoolId_key" ON "Classroom"("id", "schoolId");
CREATE UNIQUE INDEX IF NOT EXISTS "Schedule_id_schoolId_key" ON "Schedule"("id", "schoolId");
ALTER TABLE "ClassroomSchedule" ADD CONSTRAINT "ClassroomSchedule_classroom_school_fkey" FOREIGN KEY ("classroomId", "schoolId") REFERENCES "Classroom"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassroomSchedule" ADD CONSTRAINT "ClassroomSchedule_schedule_school_fkey" FOREIGN KEY ("scheduleId", "schoolId") REFERENCES "Schedule"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261124000000-add-school-to-classroom-schedule.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback:
-- ALTER TABLE "ClassroomSchedule" DROP CONSTRAINT IF EXISTS "ClassroomSchedule_schedule_school_fkey";
-- ALTER TABLE "ClassroomSchedule" DROP CONSTRAINT IF EXISTS "ClassroomSchedule_classroom_school_fkey";
-- DROP INDEX IF EXISTS "Schedule_id_schoolId_key";
-- DROP INDEX IF EXISTS "Classroom_id_schoolId_key";
-- ALTER TABLE "ClassroomSchedule" DROP COLUMN IF EXISTS "schoolId";
-- DELETE FROM "SequelizeMeta" WHERE "name" = '20261124000000-add-school-to-classroom-schedule.ts';
