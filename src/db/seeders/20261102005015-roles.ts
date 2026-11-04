import type { QueryInterface, QueryOptions } from 'sequelize';

// db:seed:all re-runs every seeder (no seeder storage), so keep this idempotent.
export async function up(queryInterface: QueryInterface) {
  const now = new Date();
  // ON CONFLICT DO NOTHING; supported at runtime but missing from QueryOptions' typings.
  const options: QueryOptions & { ignoreDuplicates: boolean } = { ignoreDuplicates: true };

  await queryInterface.bulkInsert(
    'Role',
    [
      { id: process.env.SUPERADMIN_ROLE_ID, name: 'Administrador', code: 'SUPERADMIN', status: 1, createdAt: now, updatedAt: now },
      { id: process.env.APP_ADMIN_ROLE_ID, name: 'Administrador del colegio', code: 'APP_ADMIN', status: 1, createdAt: now, updatedAt: now },
      { id: process.env.DOOR_STAFF_ROLE_ID, name: 'Personal de puerta', code: 'DOOR_STAFF', status: 1, createdAt: now, updatedAt: now },
    ],
    options,
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.bulkDelete('Role', { code: ['SUPERADMIN', 'APP_ADMIN', 'DOOR_STAFF'] });
}
