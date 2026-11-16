import type { DataTypes, QueryInterface } from 'sequelize';

// Adds "Station"."status" (SMALLINT like "School"."status"): 0 = INACTIVE, 1 = ACTIVE (see src/constants/station-status.ts).
// Existing stations start as ACTIVE.
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.addColumn('Station', 'status', { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 1 }, { transaction });
    await queryInterface.sequelize.query(
      'ALTER TABLE "Station" ADD CONSTRAINT "Station_status_check" CHECK ("status" IN (0, 1))',
      { transaction },
    );
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('Station', 'status');
}
