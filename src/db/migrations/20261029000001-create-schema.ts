import fs from 'node:fs';
import path from 'node:path';
import type { QueryInterface } from 'sequelize';

// Applies src/db/sql/schema.sql (the source of truth for the core schema; models are generated from it).
const sql = fs.readFileSync(path.join(import.meta.dirname, '..', 'sql', 'schema.sql'), 'utf8');
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
