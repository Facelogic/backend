import type { DataTypes, QueryInterface } from 'sequelize';

// "Classroom": classrooms of a school (name unique per school, level/grade/section, optional tutor "staffId" and
// capacity, status 0 = DISABLED / 1 = ENABLED). "Student"."classroomId" links each student to at most one classroom
// (a classroom has many students); ON DELETE RESTRICT so a classroom with students can't be deleted.
// The tutor FK is ON DELETE SET NULL. "level" reuses the existing "Level" enum type.
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const run = (sql: string) => queryInterface.sequelize.query(sql, { transaction });

    await run(`CREATE TABLE IF NOT EXISTS "Classroom" (
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
    )`);
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "Classroom_schoolId_name_key" ON "Classroom"("schoolId", "name")');
    await run('CREATE INDEX IF NOT EXISTS "Classroom_staffId_idx" ON "Classroom"("staffId")');

    const columns = await queryInterface.describeTable('Student');
    if (!('classroomId' in columns)) {
      await queryInterface.addColumn(
        'Student',
        'classroomId',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Classroom', key: 'id' },
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        },
        { transaction },
      );
    }
    await run('CREATE INDEX IF NOT EXISTS "Student_classroomId_idx" ON "Student"("classroomId")');
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const run = (sql: string) => queryInterface.sequelize.query(sql, { transaction });
    await run('DROP INDEX IF EXISTS "Student_classroomId_idx"');
    await run('ALTER TABLE "Student" DROP COLUMN IF EXISTS "classroomId"');
    await run('DROP TABLE IF EXISTS "Classroom"');
  });
}
