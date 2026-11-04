// Creates an empty TypeScript migration (sequelize-cli's migration:generate only emits CommonJS .js,
// which doesn't load in this ESM project).
// Usage: npm run db:migrate:create <name>
import fs from 'node:fs';
import path from 'node:path';

const name = process.argv[2];
if (!name || !/^[\w-]+$/.test(name)) {
  console.error('Usage: npm run db:migrate:create <name>   (letters, digits, _ and - only)');
  process.exit(1);
}

// Same YYYYMMDDHHmmss (UTC) prefix sequelize-cli uses, so files keep sorting in run order.
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const file = path.join(import.meta.dirname, '..', 'src', 'db', 'migrations', `${stamp}-${name}.ts`);

const template = `import type { DataTypes, QueryInterface } from 'sequelize';

export async function up(queryInterface: QueryInterface, Sequelize: typeof DataTypes) {
  // await queryInterface.addColumn('Table', 'column', { type: Sequelize.STRING, allowNull: true });
}

export async function down(queryInterface: QueryInterface) {
  // await queryInterface.removeColumn('Table', 'column');
}
`;

fs.writeFileSync(file, template, { flag: 'wx' });
console.log(`Created ${path.relative(process.cwd(), file)}`);
