import type { DataTypes, QueryInterface } from 'sequelize';

// "Student"."nationalId" (CHAR(8), DNI only) becomes "document" VARCHAR(12) + "documentTypeId" (DNI, Pasaporte, ...),
// like "User". Existing values are kept; the unique (schoolId, document) index replaces (schoolId, nationalId).
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const run = (sql: string) => queryInterface.sequelize.query(sql, { transaction });
    const columns = await queryInterface.describeTable('Student');

    if ('nationalId' in columns) {
      await queryInterface.renameColumn('Student', 'nationalId', 'document', { transaction });
      // CHAR(8) pads with spaces; trim them when widening to VARCHAR.
      await run('ALTER TABLE "Student" ALTER COLUMN "document" TYPE VARCHAR(12) USING NULLIF(TRIM("document"), \'\')');
    } else if (!('document' in columns)) {
      await queryInterface.addColumn('Student', 'document', { type: Sequelize.STRING(12), allowNull: true }, { transaction });
    }

    if (!('documentTypeId' in columns)) {
      await queryInterface.addColumn(
        'Student',
        'documentTypeId',
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'DocumentType', key: 'id' },
          onDelete: 'RESTRICT',
          onUpdate: 'CASCADE',
        },
        { transaction },
      );
    }
    // Legacy values were DNIs.
    await run(`UPDATE "Student" SET "documentTypeId" = (SELECT "id" FROM "DocumentType" WHERE "name" = 'DNI' LIMIT 1)
               WHERE "document" IS NOT NULL AND "documentTypeId" IS NULL`);

    await run('DROP INDEX IF EXISTS "Student_schoolId_nationalId_key"');
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "Student_schoolId_document_key" ON "Student"("schoolId", "document")');
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const run = (sql: string) => queryInterface.sequelize.query(sql, { transaction });
    await run('DROP INDEX IF EXISTS "Student_schoolId_document_key"');
    await queryInterface.removeColumn('Student', 'documentTypeId', { transaction });
    // Documents longer than 8 characters (Pasaporte, CE) don't fit back in CHAR(8).
    await run('UPDATE "Student" SET "document" = NULL WHERE LENGTH("document") > 8');
    await run('ALTER TABLE "Student" ALTER COLUMN "document" TYPE CHAR(8)');
    await queryInterface.renameColumn('Student', 'document', 'nationalId', { transaction });
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "Student_schoolId_nationalId_key" ON "Student"("schoolId", "nationalId")');
  });
}
