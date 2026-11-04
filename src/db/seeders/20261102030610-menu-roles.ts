import crypto from 'node:crypto';
import type { QueryInterface } from 'sequelize';

// Which menu sections (seeded by menu-items, by "Menu"."code") each role can open.
const PROVIDER_MENUS = ['P_SCHOOLS', 'P_HISTORY', 'P_STATIONS', 'P_RECOG'];
const SCHOOL_MENUS = [
  'S_PICKUPS', 'S_UNCOLL', 'S_STUDENTS', 'S_ATTEND', 'S_STAFF',
  'S_SHIFTS', 'S_ENROLL', 'S_NOTICES', 'S_REPORTS', 'S_ACCOUNTS',
];

// Role ids come from .env, the same ones the roles seeder inserts.
function assignments() {
  const roles = {
    SUPERADMIN_ROLE_ID: process.env.SUPERADMIN_ROLE_ID,
    APP_ADMIN_ROLE_ID: process.env.APP_ADMIN_ROLE_ID,
    DOOR_STAFF_ROLE_ID: process.env.DOOR_STAFF_ROLE_ID,
  };
  const missing = Object.entries(roles).filter(([, id]) => !id).map(([name]) => name);
  if (missing.length) throw new Error(`Set ${missing.join(', ')} to seed the menu roles`);

  return [
    { roleId: roles.SUPERADMIN_ROLE_ID!, menus: PROVIDER_MENUS }, // provider console
    { roleId: roles.APP_ADMIN_ROLE_ID!, menus: SCHOOL_MENUS }, // school panel
    { roleId: roles.DOOR_STAFF_ROLE_ID!, menus: SCHOOL_MENUS }, // school panel
  ];
}

// db:seed:all re-runs every seeder (no seeder storage), so keep this idempotent.
// "MenuRole" has no unique (menuId, roleId) constraint, so ignoreDuplicates (ON CONFLICT) can't be used:
// insert only the pairs that aren't there yet.
export async function up(queryInterface: QueryInterface) {
  const wanted = assignments();
  const roleIds = wanted.map((a) => a.roleId);

  const [menus] = (await queryInterface.sequelize.query('SELECT "id", "code" FROM "Menu" WHERE "code" IN (:codes)', {
    replacements: { codes: [...PROVIDER_MENUS, ...SCHOOL_MENUS] },
  })) as [{ id: string; code: string }[], unknown];
  const menuIdByCode = new Map(menus.map((m) => [m.code, m.id]));
  const notSeeded = [...PROVIDER_MENUS, ...SCHOOL_MENUS].filter((code) => !menuIdByCode.has(code));
  if (notSeeded.length) throw new Error(`Run the menu-items seeder first; missing menus: ${notSeeded.join(', ')}`);

  const [existing] = (await queryInterface.sequelize.query(
    'SELECT "menuId", "roleId" FROM "MenuRole" WHERE "roleId" IN (:roleIds)',
    { replacements: { roleIds } },
  )) as [{ menuId: string; roleId: string }[], unknown];
  const present = new Set(existing.map((row) => `${row.menuId}:${row.roleId}`));

  const now = new Date();
  const rows = wanted
    .flatMap(({ roleId, menus: codes }) => codes.map((code) => ({ menuId: menuIdByCode.get(code)!, roleId })))
    .filter((pair) => !present.has(`${pair.menuId}:${pair.roleId}`))
    .map((pair) => ({ id: crypto.randomUUID(), ...pair, createdAt: now, updatedAt: now }));

  if (rows.length) await queryInterface.bulkInsert('MenuRole', rows);
}

export async function down(queryInterface: QueryInterface) {
  const roleIds = assignments().map((a) => a.roleId);
  await queryInterface.sequelize.query(
    'DELETE FROM "MenuRole" WHERE "roleId" IN (:roleIds) AND "menuId" IN (SELECT "id" FROM "Menu" WHERE "code" IN (:codes))',
    { replacements: { roleIds, codes: [...PROVIDER_MENUS, ...SCHOOL_MENUS] } },
  );
}
