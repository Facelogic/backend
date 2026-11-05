import type { DataTypes, QueryInterface } from 'sequelize';

// Adds "User"."document": the identity document number (optional, unique), whose kind is given by
// "documentTypeId" (DNI, Pasaporte, ...). VARCHAR(12) fits the longest seeded type (Pasaporte, size 12).
// If a legacy "dni" column exists it is renamed instead, keeping its data.
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const columns = await queryInterface.describeTable('User');

    if ('dni' in columns) {
      await queryInterface.renameColumn('User', 'dni', 'document', { transaction });
      await queryInterface.changeColumn('User', 'document', { type: Sequelize.STRING(12), allowNull: true }, { transaction });
      // Rebuild the unique constraint under the new name (the legacy one may be called "User_dni_key").
      await queryInterface.sequelize.query('ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_dni_key"', { transaction });
    } else {
      await queryInterface.addColumn('User', 'document', { type: Sequelize.STRING(12), allowNull: true }, { transaction });
    }

    await queryInterface.addConstraint('User', {
      type: 'unique',
      fields: ['document'],
      name: 'User_document_key',
      transaction,
    });
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeConstraint('User', 'User_document_key', { transaction });
    await queryInterface.removeColumn('User', 'document', { transaction });
  });
}
