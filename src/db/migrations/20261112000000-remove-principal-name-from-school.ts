import type { DataTypes, QueryInterface } from 'sequelize';

// Drops "School"."principalName".
export async function up(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('School', 'principalName');
}

// Restores the column empty (the previous values are lost).
export async function down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.addColumn('School', 'principalName', { type: Sequelize.STRING(120), allowNull: true });
}
