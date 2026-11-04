import crypto from 'node:crypto';
import type { QueryInterface, QueryOptions } from 'sequelize';
import { hashPassword } from '../../utils/password.ts';

// "Role" row of the superadmin.

// Bootstraps the first SUPERADMIN (register requires an authenticated admin).
// Reads SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME.
// db:seed:all re-runs every seeder (no seeder storage), so keep this idempotent.
export async function up(queryInterface: QueryInterface) {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to seed the superadmin');

  const now = new Date();
  // ON CONFLICT DO NOTHING ("User"."email" is unique); supported at runtime but missing from QueryOptions' typings.
  const options: QueryOptions & { ignoreDuplicates: boolean } = { ignoreDuplicates: true };
  await queryInterface.bulkInsert(
    'User',
    [
      {
        id: crypto.randomUUID(),
        email,
        name: process.env.SEED_ADMIN_NAME || 'Super Admin',
        roleId: process.env.SUPERADMIN_ROLE_ID,
        status: 'ACTIVE',
        passwordHash: await hashPassword(password),
        createdAt: now,
        updatedAt: now,
      },
    ],
    options,
  );

  // A superadmin seeded before "roleId" existed is skipped by the insert above: link it to the role.
  await queryInterface.bulkUpdate('User', { roleId: process.env.SUPERADMIN_ROLE_ID, updatedAt: now }, { email, roleId: null });
}

export async function down(queryInterface: QueryInterface) {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (email) await queryInterface.bulkDelete('User', { email, roleId: process.env.SUPERADMIN_ROLE_ID });
}
