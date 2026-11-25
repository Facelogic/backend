import type { QueryInterface } from 'sequelize';

// Data only: links every existing classroom to the active schedules of its school with the same level (the rule the
// app keeps from now on, see scheduleService.syncClassroomLinks). down() leaves the links as they are.
export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(`INSERT INTO "ClassroomSchedule" ("classroomId", "scheduleId", "schoolId", "createdAt", "updatedAt")
SELECT c."id", s."id", c."schoolId", NOW(), NOW()
  FROM "Classroom" c
  JOIN "Schedule" s ON s."schoolId" = c."schoolId" AND s."level" = c."level"::text AND s."status" = 1
ON CONFLICT ("classroomId", "scheduleId") DO NOTHING`);
}

export async function down() {}
