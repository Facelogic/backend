import type { DataTypes, QueryInterface } from 'sequelize';

// Drops "School"."registrationStatus" (DRAFT | COMPLETE) and its enum type: a school is only ACTIVE or INACTIVE ("School"."status").
export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.removeColumn('School', 'registrationStatus', { transaction });
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "RegistrationStatus"', { transaction });
  });
}

// Restores the column; every school comes back as COMPLETE (the previous value is lost).
export async function down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    await queryInterface.sequelize.query(`CREATE TYPE "RegistrationStatus" AS ENUM ('DRAFT', 'COMPLETE')`, { transaction });
    await queryInterface.addColumn(
      'School',
      'registrationStatus',
      { type: Sequelize.ENUM('DRAFT', 'COMPLETE'), allowNull: false, defaultValue: 'COMPLETE' },
      { transaction },
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE "School" ALTER COLUMN "registrationStatus" SET DEFAULT 'DRAFT'`,
      { transaction },
    );
  });
}
