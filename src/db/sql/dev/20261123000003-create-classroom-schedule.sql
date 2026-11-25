-- Same change as src/db/migrations/20261123000003-create-classroom-schedule.ts, to run by hand (dev or prod).
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
-- "ClassroomSchedule": many-to-many between "Classroom" and "Schedule".
BEGIN;

CREATE TABLE IF NOT EXISTS "ClassroomSchedule" (
    "classroomId" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "ClassroomSchedule_pkey" PRIMARY KEY ("classroomId", "scheduleId"),
    CONSTRAINT "ClassroomSchedule_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClassroomSchedule_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ClassroomSchedule_scheduleId_idx" ON "ClassroomSchedule"("scheduleId");

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261123000003-create-classroom-schedule.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback:
-- DROP TABLE IF EXISTS "ClassroomSchedule";
-- DELETE FROM "SequelizeMeta" WHERE "name" = '20261123000003-create-classroom-schedule.ts';
