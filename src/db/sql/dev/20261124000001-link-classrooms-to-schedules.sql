-- Same change as src/db/migrations/20261124000001-link-classrooms-to-schedules.ts, to run by hand (dev or prod).
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
-- Data only: links every existing classroom to the active schedules of its school with the same level.
-- Run it after 20261124000000-add-school-to-classroom-schedule.sql.
BEGIN;

INSERT INTO "ClassroomSchedule" ("classroomId", "scheduleId", "schoolId", "createdAt", "updatedAt")
SELECT c."id", s."id", c."schoolId", NOW(), NOW()
  FROM "Classroom" c
  JOIN "Schedule" s ON s."schoolId" = c."schoolId" AND s."level" = c."level"::text AND s."status" = 1
ON CONFLICT ("classroomId", "scheduleId") DO NOTHING;

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261124000001-link-classrooms-to-schedules.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;
