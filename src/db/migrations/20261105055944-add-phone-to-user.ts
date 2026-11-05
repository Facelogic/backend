import type { DataTypes, QueryInterface } from 'sequelize';

// Adds "User"."phone": optional contact phone, up to 15 characters (E.164 max length, e.g. "+51987654321").
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.addColumn('User', 'phone', { type: Sequelize.STRING(15), allowNull: true });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn('User', 'phone');
}
