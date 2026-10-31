const { Sequelize, DataTypes } = require('sequelize');
// Side-effect import: adds DataTypes.VECTOR / HALFVEC / SPARSEVEC (requires `CREATE EXTENSION vector` in the DB).
require('pgvector/sequelize');
const { env } = require('../../config');
const dbConfig = require('../../config/database')[env];

const sequelize = dbConfig.use_env_variable
  ? new Sequelize(process.env[dbConfig.use_env_variable], dbConfig)
  : new Sequelize(dbConfig);

// Models are listed explicitly (no fs.readdirSync) so Vercel's bundler can trace them.
const definers = [
  require('./media'),
  // Generated from src/db/sql/schema.sql by `npm run db:models` ("Table"."camelColumn").
  require('./school'),
  require('./level-schedule'),
  require('./school-settings'),
  require('./station'),
  require('./user'),
  require('./session'),
  require('./invitation'),
  require('./student'),
  require('./guardian'),
  require('./authorization'),
  require('./shift'),
  require('./staff'),
  require('./time-entry'),
  require('./face-enrollment'),
  require('./arrival'),
  require('./pickup'),
  require('./pickup-photo'),
  require('./pickup-counter'),
  require('./notification'),
  require('./alert'),
  require('./pickup-code'),
  require('./face-parameters'),
  require('./report-download'),
  require('./audit-log'),
];

const db = {};
definers.forEach((define) => {
  const model = define(sequelize, DataTypes);
  db[model.name] = model;
});

Object.values(db).forEach((model) => model.associate?.(db));

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
