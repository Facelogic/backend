import type { QueryInterface } from 'sequelize';

// "ClassroomSchedule"."schoolId": the classroom and the schedule of each link must belong to the same school.
// Enforced by the database with two composite FKs that share "schoolId":
//   ("classroomId", "schoolId") -> "Classroom"("id", "schoolId") and ("scheduleId", "schoolId") -> "Schedule"("id", "schoolId")
// (each needs a unique index on ("id", "schoolId") in the referenced table). Existing links take the classroom's
// school; if any of them points to a schedule of another school the second FK fails and nothing changes.
export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const run = (sql: string) => queryInterface.sequelize.query(sql, { transaction });
    await run('ALTER TABLE "ClassroomSchedule" ADD COLUMN IF NOT EXISTS "schoolId" UUID');
    await run('UPDATE "ClassroomSchedule" cs SET "schoolId" = c."schoolId" FROM "Classroom" c WHERE c."id" = cs."classroomId" AND cs."schoolId" IS NULL');
    await run('ALTER TABLE "ClassroomSchedule" ALTER COLUMN "schoolId" SET NOT NULL');
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "Classroom_id_schoolId_key" ON "Classroom"("id", "schoolId")');
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "Schedule_id_schoolId_key" ON "Schedule"("id", "schoolId")');
    await run('ALTER TABLE "ClassroomSchedule" ADD CONSTRAINT "ClassroomSchedule_classroom_school_fkey" FOREIGN KEY ("classroomId", "schoolId") REFERENCES "Classroom"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE');
    await run('ALTER TABLE "ClassroomSchedule" ADD CONSTRAINT "ClassroomSchedule_schedule_school_fkey" FOREIGN KEY ("scheduleId", "schoolId") REFERENCES "Schedule"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE');
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const run = (sql: string) => queryInterface.sequelize.query(sql, { transaction });
    await run('ALTER TABLE "ClassroomSchedule" DROP CONSTRAINT IF EXISTS "ClassroomSchedule_schedule_school_fkey"');
    await run('ALTER TABLE "ClassroomSchedule" DROP CONSTRAINT IF EXISTS "ClassroomSchedule_classroom_school_fkey"');
    await run('DROP INDEX IF EXISTS "Schedule_id_schoolId_key"');
    await run('DROP INDEX IF EXISTS "Classroom_id_schoolId_key"');
    await run('ALTER TABLE "ClassroomSchedule" DROP COLUMN IF EXISTS "schoolId"');
  });
}
