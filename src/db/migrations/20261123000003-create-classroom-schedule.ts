import type { QueryInterface } from 'sequelize';

// "ClassroomSchedule": many-to-many between "Classroom" and "Schedule" (a schedule can be linked to many classrooms
// and a classroom to many schedules). The composite primary key keeps each pair unique. Both FKs are ON DELETE
// CASCADE: deleting a classroom or a schedule removes its links.
export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const run = (sql: string) => queryInterface.sequelize.query(sql, { transaction });
    await run(`CREATE TABLE IF NOT EXISTS "ClassroomSchedule" (
      "classroomId" UUID NOT NULL,
      "scheduleId" UUID NOT NULL,
      "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ(3) NOT NULL,
      CONSTRAINT "ClassroomSchedule_pkey" PRIMARY KEY ("classroomId", "scheduleId"),
      CONSTRAINT "ClassroomSchedule_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ClassroomSchedule_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`);
    await run('CREATE INDEX IF NOT EXISTS "ClassroomSchedule_scheduleId_idx" ON "ClassroomSchedule"("scheduleId")');
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query('DROP TABLE IF EXISTS "ClassroomSchedule"');
}
