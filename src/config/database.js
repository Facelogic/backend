// Shared by the app (src/db/models/index.js) and sequelize-cli (.sequelizerc).
const pg = require('pg');
const { db } = require('./index');

const base = {
  dialect: 'postgres',
  // Explicit module so Vercel's file tracing bundles `pg` (Sequelize requires it dynamically).
  dialectModule: pg,
  ...(db.url
    ? { use_env_variable: 'DATABASE_URL' }
    : { host: db.host, port: db.port, database: db.database, username: db.username, password: db.password }),
  dialectOptions: db.ssl ? { ssl: { require: true } } : {},
  logging: false,
  // Keep the pool small: on serverless every instance opens its own pool.
  pool: { max: db.poolMax, min: 0, acquire: 30000, idle: 5000 },
  // Tables use Prisma naming ("Colegio"."colegioId"); models that use snake_case opt in with `underscored: true`.
  define: { freezeTableName: true, timestamps: true },
};

module.exports = {
  development: { ...base, logging: console.log },
  test: base,
  production: base,
};
