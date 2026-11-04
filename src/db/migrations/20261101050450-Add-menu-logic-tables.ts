import type { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.createTable(
      'Menu',
      {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        name: { type: Sequelize.STRING(120), allowNull: false },
        code: { type: Sequelize.STRING(10), allowNull: false },
        title: { type: Sequelize.STRING(60), allowNull: false },
        description: { type: Sequelize.STRING(120), allowNull: true },
        path: { type: Sequelize.STRING(120), allowNull: false },
        status: { type: Sequelize.SMALLINT, defaultValue: 1, allowNull: false },
        createdAt: { type: Sequelize.DATE(3), allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE(3), allowNull: false },
      },
      { transaction }
    );

    await queryInterface.createTable(
      'MenuRole',
      {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        menuId: { type: Sequelize.UUID, allowNull: false },
        roleId: { type: Sequelize.UUID, allowNull: false },
        createdAt: { type: Sequelize.DATE(3), allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE(3), allowNull: false },
      },
      { transaction },
    );
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.dropTable('Menu', { transaction, cascade: true });
    await queryInterface.dropTable('MenuRole', { transaction });
  });
}
