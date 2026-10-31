'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Applies src/db/sql/schema.sql (the source of truth for the core schema; models are generated from it).
const sql = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8');
const tables = [...sql.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]);
const types = [...sql.matchAll(/CREATE TYPE "(\w+)"/g)].map((m) => m[1]);

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(sql);
  },

  async down(queryInterface) {
    const drops = [
      ...tables.reverse().map((t) => `DROP TABLE IF EXISTS "${t}" CASCADE;`),
      ...types.map((t) => `DROP TYPE IF EXISTS "${t}";`),
    ];
    await queryInterface.sequelize.query(drops.join('\n'));
  },
};
