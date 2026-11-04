// Creates an empty TypeScript seeder (sequelize-cli's seed:generate only emits CommonJS .js,
// which doesn't load in this ESM project).
// Usage: npm run db:seed:create <name>
import fs from 'node:fs';
import path from 'node:path';

const name = process.argv[2];
if (!name || !/^[\w-]+$/.test(name)) {
  console.error('Usage: npm run db:seed:create <name>   (letters, digits, _ and - only)');
  process.exit(1);
}

// Same YYYYMMDDHHmmss (UTC) prefix sequelize-cli uses, so files keep sorting in run order.
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const file = path.join(import.meta.dirname, '..', 'src', 'db', 'seeders', `${stamp}-${name}.ts`);

const template = `import crypto from 'node:crypto';
import type { QueryInterface, QueryOptions } from 'sequelize';

// db:seed:all re-runs every seeder (no seeder storage), so keep this idempotent.
export async function up(queryInterface: QueryInterface) {
  const now = new Date();
  // ON CONFLICT DO NOTHING; supported at runtime but missing from QueryOptions' typings.
  const options: QueryOptions & { ignoreDuplicates: boolean } = { ignoreDuplicates: true };

  // await queryInterface.bulkInsert(
  //   'Table',
  //   [{ id: crypto.randomUUID(), name: 'Example', createdAt: now, updatedAt: now }],
  //   options,
  // );
}

export async function down(queryInterface: QueryInterface) {
  // await queryInterface.bulkDelete('Table', { name: ['Example'] });
}
`;

fs.writeFileSync(file, template, { flag: 'wx' });
console.log(`Created ${path.relative(process.cwd(), file)}`);
