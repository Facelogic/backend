// Shared by the app (src/db/models/index.ts) and sequelize-cli (.sequelizerc).
import pg from 'pg';
import type { Options } from 'sequelize';
import config from './index.ts';

const { db } = config;

export type DbConfig = Options & { use_env_variable?: string };

// Sequelize splits FACELOIGC_DATABASE_URL into host/user/... and drops its query string, so a
// `sslmode=require` (Neon, Supabase...) would be ignored. Honor it here; DB_SSL=true still forces SSL.
function urlRequiresSsl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const mode = new URL(url).searchParams.get('sslmode');
    return mode !== null && mode !== 'disable' && mode !== 'allow' && mode !== 'prefer';
  } catch {
    return false;
  }
}

const useSsl = db.ssl || urlRequiresSsl(db.url);

const base: DbConfig = {
  dialect: 'postgres',
  dialectModule: pg,
  ...(db.url
    ? { use_env_variable: 'FACELOIGC_DATABASE_URL' }
    : { host: db.host, port: db.port, database: db.database, username: db.username, password: db.password }),
  dialectOptions: useSsl ? { ssl: { require: true } } : {},
  logging: false,
  // Keep the pool small: on serverless every instance opens its own pool.
  pool: { max: db.poolMax, min: 0, acquire: 30000, idle: 5000 },
  // Tables use Prisma naming ("Colegio"."colegioId"); models that use snake_case opt in with `underscored: true`.
  define: { freezeTableName: true, timestamps: true },
};

const configs: Record<string, DbConfig> = {
  development: { ...base, logging: console.log },
  test: base,
  production: base,
};

export default configs;
