import type { DataTypes, QueryInterface } from 'sequelize';

// Creates the "Role" catalog and links users to it through "User"."roleId".
// "roleId" stays nullable and the old "User"."role" enum column is kept: existing users
// have to be mapped to a Role row before either can be tightened or dropped.
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    // A Postgres table also defines a type with its name, so the old enum type "Role" must move aside.
    await queryInterface.sequelize.query('ALTER TYPE "Role" RENAME TO "UserRole";', { transaction });

    await queryInterface.createTable(
      'Role',
      {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        name: { type: Sequelize.STRING(120), allowNull: false },
        code: { type: Sequelize.STRING(10), allowNull: false, unique: true },
        status: { type: Sequelize.SMALLINT, allowNull: false, defaultValue: 1 },
        createdAt: { type: Sequelize.DATE(3), allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE(3), allowNull: false },
      },
      { transaction },
    );

    await queryInterface.addColumn(
      'User',
      'roleId',
      {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Role', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      { transaction },
    );
    await queryInterface.addIndex('User', ['roleId'], { name: 'User_roleId_idx', transaction });
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeColumn('User', 'roleId', { transaction });
    await queryInterface.dropTable('Role', { transaction });
    await queryInterface.sequelize.query('ALTER TYPE "UserRole" RENAME TO "Role";', { transaction });
  });
}
