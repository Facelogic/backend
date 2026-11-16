import fs from 'node:fs';
import path from 'node:path';
import type { QueryInterface } from 'sequelize';

// Applies src/db/sql/schema.initial.sql: the core schema as it was when this migration was written. It is frozen —
// later changes are separate migrations. src/db/sql/schema.sql is the CURRENT schema (all migrations applied),
// which the models are generated from; applying it here would make the later migrations fail.
const sql = fs.readFileSync(path.join(import.meta.dirname, '..', 'sql', 'schema.initial.sql'), 'utf8');
const tables = [...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]);
const types = [...sql.matchAll(/CREATE TYPE "(\w+)"/g)].map((m) => m[1]);

export async function up(queryInterface: QueryInterface) {
  await queryInterface.sequelize.query(sql);
}

export async function down(queryInterface: QueryInterface) {
  const drops = [
    ...tables.reverse().map((t) => `DROP TABLE IF EXISTS "${t}" CASCADE;`),
    ...types.map((t) => `DROP TYPE IF EXISTS "${t}";`),
  ];
  await queryInterface.sequelize.query(drops.join('\n'));
}
