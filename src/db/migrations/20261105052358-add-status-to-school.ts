import type { DataTypes, QueryInterface } from 'sequelize';

// Adds "School"."status" (SMALLINT like "Role"."status"): 0 = INACTIVE, 1 = ACTIVE (see src/constants/school-status.ts).
// Schools are never hard-deleted (students, pickups, time entries... reference them with ON DELETE RESTRICT),
// so DELETE /api/schools/:id sets the status to 0.
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addColumn('School', 'status', { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 1 }, { transaction });
    await queryInterface.sequelize.query(
      'ALTER TABLE "School" ADD CONSTRAINT "School_status_check" CHECK ("status" IN (0, 1))',
      { transaction },
    );
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('School', 'status');
}
