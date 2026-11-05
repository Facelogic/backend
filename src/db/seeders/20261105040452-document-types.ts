import crypto from 'node:crypto';
import type { QueryInterface, QueryOptions } from 'sequelize';

// "size" is the expected length of the document number.
const documentTypes = [
  { name: 'DNI', size: 8, description: 'Documento Nacional de Identidad' },
  { name: 'Pasaporte', size: 12, description: null },
];

// db:seed:all re-runs every seeder (no seeder storage), so keep this idempotent.
export async function up(queryInterface: QueryInterface) {
  const now = new Date();
  // ON CONFLICT DO NOTHING ("DocumentType"."name" is unique); supported at runtime but missing from QueryOptions' typings.
  const options: QueryOptions & { ignoreDuplicates: boolean } = { ignoreDuplicates: true };

  await queryInterface.bulkInsert(
    'DocumentType',
    documentTypes.map((type) => ({ id: crypto.randomUUID(), ...type, createdAt: now, updatedAt: now })),
    options,
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.bulkDelete('DocumentType', { name: documentTypes.map((type) => type.name) });
}
