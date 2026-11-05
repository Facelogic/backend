import type { DataTypes, QueryInterface } from 'sequelize';

// Creates the "DocumentType" catalog (DNI, Pasaporte, ...) and links users to it through
// "User"."documentTypeId" (optional). "size" is the expected length of the document number.
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.createTable(
      'DocumentType',
      {
        id: { type: Sequelize.UUID, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        name: { type: Sequelize.STRING(60), allowNull: false, unique: true },
        size: { type: Sequelize.SMALLINT, allowNull: false },
        description: { type: Sequelize.STRING(255), allowNull: true },
        createdAt: { type: Sequelize.DATE(3), allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE(3), allowNull: false },
      },
      { transaction },
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE "DocumentType" ADD CONSTRAINT "DocumentType_size_check" CHECK ("size" > 0)',
      { transaction },
    );

    await queryInterface.addColumn(
      'User',
      'documentTypeId',
      {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'DocumentType', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      { transaction },
    );
    await queryInterface.addIndex('User', ['documentTypeId'], { name: 'User_documentTypeId_idx', transaction });
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeColumn('User', 'documentTypeId', { transaction });
    await queryInterface.dropTable('DocumentType', { transaction });
  });
}
