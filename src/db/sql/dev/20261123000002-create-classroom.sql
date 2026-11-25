-- Same change as src/db/migrations/20261123000002-create-classroom.ts, to run by hand (dev or prod).
-- The SequelizeMeta row marks the migration as applied, so a later `npm run db:migrate` skips it instead of failing.
-- "Classroom" table + "Student"."classroomId" (a student belongs to at most one classroom).
BEGIN;

CREATE TABLE IF NOT EXISTS "Classroom" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "level" "Level" NOT NULL,
    "grade" VARCHAR(20) NOT NULL,
    "section" VARCHAR(10) NOT NULL,
    "staffId" UUID,
    "capacity" INTEGER,
    "status" SMALLINT NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Classroom_status_check" CHECK ("status" IN (0, 1)),
    CONSTRAINT "Classroom_capacity_check" CHECK ("capacity" IS NULL OR "capacity" > 0),
    CONSTRAINT "Classroom_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Classroom_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Classroom_schoolId_name_key" ON "Classroom"("schoolId", "name");
CREATE INDEX IF NOT EXISTS "Classroom_staffId_idx" ON "Classroom"("staffId");

ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "classroomId" UUID;
ALTER TABLE "Student" ADD CONSTRAINT "Student_classroomId_fkey"
  FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "Student_classroomId_idx" ON "Student"("classroomId");

INSERT INTO "SequelizeMeta" ("name")
VALUES ('20261123000002-create-classroom.ts')
ON CONFLICT ("name") DO NOTHING;

COMMIT;

-- Rollback:
-- DROP INDEX IF EXISTS "Student_classroomId_idx";
-- ALTER TABLE "Student" DROP COLUMN IF EXISTS "classroomId";
-- DROP TABLE IF EXISTS "Classroom";
-- DELETE FROM "SequelizeMeta" WHERE "name" = '20261123000002-create-classroom.ts';
