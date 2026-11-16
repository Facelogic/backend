import type { DataTypes, QueryInterface } from 'sequelize';

// Adds "User"."position": optional job title shown in the user list (same size as "Staff"."position").
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.addColumn('User', 'position', { type: Sequelize.STRING(80), allowNull: true });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('User', 'position');
}
