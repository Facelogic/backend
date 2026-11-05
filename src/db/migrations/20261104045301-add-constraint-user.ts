import type { QueryInterface } from 'sequelize';

// Tightens "User" now that every account is linked to a "Role" row:
// - drops the legacy "role" enum column (replaced by "roleId") and its "UserRole" type;
// - "roleId" becomes NOT NULL (the FK "User_roleId_fkey" already exists);
// - "status" goes from the "AccountStatus" enum to SMALLINT (Postgres has no TINYINT), like "Role"."status":
//   0 = DISABLED, 1 = ACTIVE, 2 = INVITED (see src/constants/user-status.ts), guarded by a CHECK.
// "email" is already unique ("User_email_key").
export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const run = (sql: string) => queryInterface.sequelize.query(sql, { transaction });

    const [orphans] = (await run('SELECT "email" FROM "User" WHERE "roleId" IS NULL')) as [{ email: string }[], unknown];
    if (orphans.length) {
      throw new Error(`Assign a roleId to these users before migrating: ${orphans.map((u) => u.email).join(', ')}`);
    }

    await run('ALTER TABLE "User" DROP COLUMN IF EXISTS "role"');
    await run('DROP TYPE IF EXISTS "UserRole"');
    await run('ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL');

    await run('ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT');
    await run(`
      ALTER TABLE "User" ALTER COLUMN "status" TYPE SMALLINT USING (
        CASE "status"::text WHEN 'DISABLED' THEN 0 WHEN 'ACTIVE' THEN 1 WHEN 'INVITED' THEN 2 END
      )`);
    await run('ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 2');
    await run('ALTER TABLE "User" ADD CONSTRAINT "User_status_check" CHECK ("status" IN (0, 1, 2))');
    await run('DROP TYPE IF EXISTS "AccountStatus"');
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.sequelize.transaction(async (transaction) => {
    const run = (sql: string) => queryInterface.sequelize.query(sql, { transaction });

    await run(`CREATE TYPE "AccountStatus" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED')`);
    await run('ALTER TABLE "User" DROP CONSTRAINT "User_status_check"');
    await run('ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT');
    await run(`
      ALTER TABLE "User" ALTER COLUMN "status" TYPE "AccountStatus" USING (
        CASE "status" WHEN 0 THEN 'DISABLED' WHEN 1 THEN 'ACTIVE' ELSE 'INVITED' END
      )::"AccountStatus"`);
    await run(`ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'INVITED'`);

    await run('ALTER TABLE "User" ALTER COLUMN "roleId" DROP NOT NULL');
    // The legacy column comes back nullable: its old values can't be rebuilt from "Role".
    await run(`CREATE TYPE "UserRole" AS ENUM ('SUPERADMIN', 'PRINCIPAL', 'COORDINATOR', 'SECRETARY', 'GATEKEEPER')`);
    await run('ALTER TABLE "User" ADD COLUMN "role" "UserRole"');
  });
}
