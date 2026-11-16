import type { DataTypes, QueryInterface } from 'sequelize';

// Creates "Schedule": a school's start/end time per level (PRESCHOOL, PRIMARY, SECONDARY).
// "status" is a SMALLINT like "School"."status": 0 = INACTIVE, 1 = ACTIVE.
// Schools are soft-deleted (DELETE /api/schools/:id), which also sets their schedules to 0;
// the FK cascades in case a school row is ever hard-deleted.
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.createTable(
      'Schedule',
      {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        schoolId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'School', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        level: { type: Sequelize.STRING(10), allowNull: false },
        startTime: { type: Sequelize.TIME, allowNull: false },
        endTime: { type: Sequelize.TIME, allowNull: false },
        status: { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 1 },
        createdAt: { type: Sequelize.DATE(3), allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE(3), allowNull: false },
      },
      { transaction },
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE "Schedule"
         ADD CONSTRAINT "Schedule_level_check" CHECK ("level" IN ('PRESCHOOL', 'PRIMARY', 'SECONDARY')),
         ADD CONSTRAINT "Schedule_status_check" CHECK ("status" IN (0, 1)),
         ADD CONSTRAINT "Schedule_time_check" CHECK ("startTime" < "endTime")`,
      { transaction },
    );
    await queryInterface.addIndex('Schedule', ['schoolId'], { name: 'Schedule_schoolId_idx', transaction });
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.dropTable('Schedule');
}
