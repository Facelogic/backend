import type { DataTypes, QueryInterface } from 'sequelize';

// "TimeEntry"."shiftId": the shift chosen when recording the attendance (FK "Shift", ON DELETE RESTRICT so a shift
// with attendance can't be deleted). Nullable for the existing rows; they are linked by name ("shiftName") within
// their school when it matches exactly one shift. "shiftName" stays as a snapshot of the name at that time.
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const run = (sql: string) => queryInterface.sequelize.query(sql, { transaction });
    const columns = await queryInterface.describeTable('TimeEntry');

    if (!('shiftId' in columns)) {
      await queryInterface.addColumn(
        'TimeEntry',
        'shiftId',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'Shift', key: 'id' },
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        },
        { transaction },
      );
    }

    await run(`UPDATE "TimeEntry" t SET "shiftId" = s."id"
               FROM "Shift" s
               WHERE t."shiftId" IS NULL AND s."schoolId" = t."schoolId" AND s."name" = t."shiftName"
                 AND (SELECT COUNT(*) FROM "Shift" x WHERE x."schoolId" = t."schoolId" AND x."name" = t."shiftName") = 1`);

    await run('CREATE INDEX IF NOT EXISTS "TimeEntry_shiftId_idx" ON "TimeEntry"("shiftId")');
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "TimeEntry_shiftId_idx"', { transaction });
    await queryInterface.removeColumn('TimeEntry', 'shiftId', { transaction });
  });
}
