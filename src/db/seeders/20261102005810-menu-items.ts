import crypto from 'node:crypto';
import type { QueryInterface } from 'sequelize';

// Menu sections of the frontend (routes.tsx). The frontend allows a page when the menu includes
// the first segment of its path, so there is one item per section, not per page:
// "colegios" also covers colegios/nuevo, colegios/:schoolId and colegios/:schoolId/editar.
// "path" is the full route, so it also tells the area: /proveedor/... (provider) or /colegio/:slug/... (school).
const items = [
  // Provider console
  { code: 'P_SCHOOLS', name: 'provider.schools', title: 'Colegios', path: '/proveedor/colegios', description: 'Alta, edición y consulta de colegios' },
  { code: 'P_HISTORY', name: 'provider.history', title: 'Historial', path: '/proveedor/historial', description: 'Historial de recojos y su detalle' },
  { code: 'P_STATIONS', name: 'provider.stations', title: 'Estaciones', path: '/proveedor/estaciones', description: 'Estaciones de reconocimiento' },
  { code: 'P_RECOG', name: 'provider.recognition', title: 'Reconocimiento', path: '/proveedor/reconocimiento', description: 'Reconocimiento facial' },
  // School panel
  { code: 'S_PICKUPS', name: 'school.pickups', title: 'Recojos', path: '/colegio/:slug/recojos', description: 'Recojos del día' },
  { code: 'S_UNCOLL', name: 'school.uncollected', title: 'Sin recoger', path: '/colegio/:slug/sin-recoger', description: 'Alumnos sin recoger' },
  { code: 'S_STUDENTS', name: 'school.students', title: 'Alumnos', path: '/colegio/:slug/alumnos', description: 'Alumnos y su detalle' },
  { code: 'S_ATTEND', name: 'school.attendance', title: 'Asistencia', path: '/colegio/:slug/asistencia', description: 'Asistencia' },
  { code: 'S_STAFF', name: 'school.staff', title: 'Personal', path: '/colegio/:slug/personal', description: 'Personal del colegio' },
  { code: 'S_SHIFTS', name: 'school.shifts', title: 'Turnos', path: '/colegio/:slug/turnos', description: 'Turnos' },
  { code: 'S_ENROLL', name: 'school.enrollment', title: 'Enrolamiento', path: '/colegio/:slug/enrolamiento', description: 'Enrolamiento facial' },
  { code: 'S_NOTICES', name: 'school.notices', title: 'Avisos', path: '/colegio/:slug/avisos', description: 'Avisos' },
  { code: 'S_REPORTS', name: 'school.reports', title: 'Reportes', path: '/colegio/:slug/reportes', description: 'Reportes' },
  { code: 'S_ACCOUNTS', name: 'school.accounts', title: 'Cuentas', path: '/colegio/:slug/cuentas', description: 'Cuentas de acceso' },
];

const codes = items.map((item) => item.code);

// db:seed:all re-runs every seeder (no seeder storage), so keep this idempotent.
// "Menu"."code" has no unique constraint, so ignoreDuplicates (ON CONFLICT) can't be used:
// insert only the codes that aren't there yet.
export async function up(queryInterface: QueryInterface) {
  const [existing] = (await queryInterface.sequelize.query('SELECT "code" FROM "Menu" WHERE "code" IN (:codes)', {
    replacements: { codes },
  })) as [{ code: string }[], unknown];
  const present = new Set(existing.map((row) => row.code));

  const now = new Date();
  const rows = items
    .filter((item) => !present.has(item.code))
    .map((item) => ({ id: crypto.randomUUID(), ...item, status: 1, createdAt: now, updatedAt: now }));

  if (rows.length) await queryInterface.bulkInsert('Menu', rows);
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.bulkDelete('Menu', { code: codes });
}
