import type { DataTypes, QueryInterface } from 'sequelize';

// "Staff" stops storing personal data and points to its "User" instead ("Staff"."userId", unique, FK "User" ON DELETE
// RESTRICT). The school, name, document, email and position now live only in "User"; "Staff" keeps the department,
// shift and active flag. Existing rows are linked to the user of the same school with the same email or document
// (copying the position to the user when it has none); if any row can't be linked the migration fails and nothing
// changes, so those staff members must get a user first.
export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const run = (sql: string) => queryInterface.sequelize.query(sql, { transaction });
    const columns = await queryInterface.describeTable('Staff');

    if (!('userId' in columns)) {
      await queryInterface.addColumn('Staff', 'userId', { type: Sequelize.UUID, allowNull: true }, { transaction });
    }

    if ('name' in columns) {
      await run(`UPDATE "Staff" s SET "userId" = (
                   SELECT u."id" FROM "User" u
                   WHERE u."schoolId" = s."schoolId"
                     AND ((s."email" IS NOT NULL AND LOWER(u."email") = LOWER(s."email")) OR u."document" = s."nationalId")
                   ORDER BY (s."email" IS NOT NULL AND LOWER(u."email") = LOWER(s."email")) DESC
                   LIMIT 1)
                 WHERE s."userId" IS NULL`);
      await run(`UPDATE "User" u SET "position" = s."position"
                 FROM "Staff" s
                 WHERE s."userId" = u."id" AND u."position" IS NULL`);
    }

    const [unlinked] = await run('SELECT COUNT(*)::int AS "count" FROM "Staff" WHERE "userId" IS NULL');
    const count = (unlinked as { count: number }[])[0]?.count ?? 0;
    if (count > 0) throw new Error(`${count} registro(s) de "Staff" no tienen un "User" con el mismo correo o documento en su colegio`);

    await queryInterface.changeColumn('Staff', 'userId', { type: Sequelize.UUID, allowNull: false }, { transaction });
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "Staff_userId_key" ON "Staff"("userId")');
    await run(`ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey"
               FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);

    await run('DROP INDEX IF EXISTS "Staff_schoolId_nationalId_key"');
    await run('ALTER TABLE "Staff" DROP CONSTRAINT IF EXISTS "Staff_schoolId_fkey"');
    for (const column of ['nationalId', 'name', 'email', 'position', 'schoolId']) {
      if (column in columns) await queryInterface.removeColumn('Staff', column, { transaction });
    }
  });
}

// Restores the columns, copying the data back from each linked user (nationalId falls back to 8 spaces when the
// user has no document).
export async function down(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const run = (sql: string) => queryInterface.sequelize.query(sql, { transaction });

    await queryInterface.addColumn('Staff', 'schoolId', { type: Sequelize.UUID, allowNull: true }, { transaction });
    await queryInterface.addColumn('Staff', 'nationalId', { type: Sequelize.CHAR(8), allowNull: true }, { transaction });
    await queryInterface.addColumn('Staff', 'name', { type: Sequelize.STRING(120), allowNull: true }, { transaction });
    await queryInterface.addColumn('Staff', 'position', { type: Sequelize.STRING(80), allowNull: true }, { transaction });
    await queryInterface.addColumn('Staff', 'email', { type: Sequelize.STRING(160), allowNull: true }, { transaction });

    await run(`UPDATE "Staff" s SET "schoolId" = u."schoolId", "nationalId" = COALESCE(LEFT(u."document", 8), '        '), "name" = u."name",
                 "position" = COALESCE(u."position", ''), "email" = u."email"
               FROM "User" u WHERE u."id" = s."userId"`);

    await queryInterface.changeColumn('Staff', 'schoolId', { type: Sequelize.UUID, allowNull: false }, { transaction });
    await run(`ALTER TABLE "Staff" ADD CONSTRAINT "Staff_schoolId_fkey"
               FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE`);
    await queryInterface.changeColumn('Staff', 'nationalId', { type: Sequelize.CHAR(8), allowNull: false }, { transaction });
    await queryInterface.changeColumn('Staff', 'name', { type: Sequelize.STRING(120), allowNull: false }, { transaction });
    await queryInterface.changeColumn('Staff', 'position', { type: Sequelize.STRING(80), allowNull: false }, { transaction });

    await run('ALTER TABLE "Staff" DROP CONSTRAINT IF EXISTS "Staff_userId_fkey"');
    await run('DROP INDEX IF EXISTS "Staff_userId_key"');
    await queryInterface.removeColumn('Staff', 'userId', { transaction });
    await run('CREATE UNIQUE INDEX IF NOT EXISTS "Staff_schoolId_nationalId_key" ON "Staff"("schoolId", "nationalId")');
  });
}
