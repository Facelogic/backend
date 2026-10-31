// Generates one Sequelize model per table from src/db/sql/schema.sql.
// Usage: npm run db:models   (overwrites the generated files in src/db/models; media.js and index.js are untouched)
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sqlPath = path.join(root, 'src', 'db', 'sql', 'schema.sql');
const outDir = path.join(root, 'src', 'db', 'models');
const sql = fs.readFileSync(sqlPath, 'utf8');

const enums = {};
for (const m of sql.matchAll(/CREATE TYPE "(\w+)" AS ENUM \(([^)]*)\);/g)) {
  enums[m[1]] = m[2].split(',').map((v) => v.trim());
}

const tables = {};
for (const m of sql.matchAll(/CREATE TABLE "(\w+)" \(([\s\S]*?)\n\);/g)) {
  const name = m[1];
  const columns = [];
  let pk = [];
  for (const raw of m[2].split('\n')) {
    const line = raw.trim().replace(/,$/, '');
    if (!line) continue;
    const pkm = line.match(/PRIMARY KEY \(([^)]*)\)/);
    if (pkm) {
      pk = pkm[1].split(',').map((c) => c.trim().replace(/"/g, ''));
      continue;
    }
    const cm = line.match(/^"(\w+)" ("?\w+"?(?: PRECISION)?(?:\(\d+\))?)(.*)$/);
    if (!cm) throw new Error(`Unparsed line in ${name}: ${line}`);
    const [, col, type, rest] = cm;
    const def = rest.match(/DEFAULT (\S+)/);
    columns.push({ col, type, notNull: /NOT NULL/.test(rest), def: def && def[1] });
  }
  tables[name] = { name, columns, pk, fks: [] };
}

const uniqueCols = new Set();
for (const m of sql.matchAll(/CREATE UNIQUE INDEX "\w+" ON "(\w+)"\("(\w+)"\);/g)) uniqueCols.add(`${m[1]}.${m[2]}`);

for (const m of sql.matchAll(/ALTER TABLE "(\w+)" ADD CONSTRAINT "\w+" FOREIGN KEY \("(\w+)"\) REFERENCES "(\w+)"\("(\w+)"\)/g)) {
  const [, child, col, parent] = m;
  const t = tables[child];
  const isPkSingle = t.pk.length === 1 && t.pk[0] === col;
  t.fks.push({ col, parent, unique: isPkSingle || uniqueCols.has(`${child}.${col}`) });
}

const lcfirst = (s) => s[0].toLowerCase() + s.slice(1);
const ucfirst = (s) => s[0].toUpperCase() + s.slice(1);
const PLURAL_OVERRIDES = { Staff: 'staff', FaceParameters: 'faceParameters', SchoolSettings: 'schoolSettings' };
function plural(model) {
  if (PLURAL_OVERRIDES[model]) return PLURAL_OVERRIDES[model];
  const s = lcfirst(model);
  if (/[^aeiou]y$/.test(s)) return s.slice(0, -1) + 'ies';
  if (/(s|sh|ch|x)$/.test(s)) return s + 'es';
  return s + 's';
}
// Readable aliases for hasMany/hasOne: by child model, or by "Parent.Child.fkColumn".
const ALIASES = {
  LevelSchedule: 'schedules',
  SchoolSettings: 'settings',
  PickupPhoto: 'photos',
  'Guardian.PickupCode.requestedById': 'requestedPickupCodes',
  'User.Alert.resolvedById': 'resolvedAlerts',
  'User.TimeEntry.recordedById': 'recordedTimeEntries',
  'User.Pickup.recordedById': 'recordedPickups',
  'User.FaceParameters.createdById': 'createdFaceParameters',
};
const kebab = (s) => s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

function jsType(c) {
  const t = c.type;
  let m;
  if (t === 'UUID') return 'DataTypes.UUID';
  if ((m = t.match(/^VARCHAR\((\d+)\)$/))) return `DataTypes.STRING(${m[1]})`;
  if ((m = t.match(/^CHAR\((\d+)\)$/))) return `DataTypes.CHAR(${m[1]})`;
  if ((m = t.match(/^TIMESTAMPTZ\((\d+)\)$/))) return `DataTypes.DATE(${m[1]})`;
  if (t === 'DATE') return 'DataTypes.DATEONLY';
  if (t === 'INTEGER' || t === 'SERIAL') return 'DataTypes.INTEGER';
  if (t === 'BOOLEAN') return 'DataTypes.BOOLEAN';
  if (t === 'DOUBLE PRECISION') return 'DataTypes.DOUBLE';
  if (t === 'JSONB') return 'DataTypes.JSONB';
  if ((m = t.match(/^"(\w+)"$/)) && enums[m[1]]) return `DataTypes.ENUM(${enums[m[1]].join(', ')})`;
  throw new Error(`Unknown type ${t}`);
}

function jsDefault(c) {
  if (!c.def) return null;
  if (c.def === 'CURRENT_TIMESTAMP') return 'DataTypes.NOW';
  return c.def; // true/false, numbers and 'ENUM' literals are valid JS as-is
}

// Timestamp columns Sequelize manages itself (sets them on create/update).
function timestampsFor(t) {
  const col = (n) => t.columns.find((c) => c.col === n);
  const createdAt = col('createdAt')?.def ? 'createdAt' : t.name === 'AuditLog' ? 'occurredAt' : null;
  const updatedAt = col('updatedAt') ? 'updatedAt' : null;
  return { createdAt, updatedAt };
}

const files = [];

for (const t of Object.values(tables)) {
  const { createdAt, updatedAt } = timestampsFor(t);
  const attrs = t.columns
    .filter((c) => c.col !== createdAt && c.col !== updatedAt)
    .map((c) => {
      const props = [`type: ${jsType(c)}`];
      if (t.pk.includes(c.col)) props.push('primaryKey: true');
      if (c.type === 'SERIAL') props.push('autoIncrement: true');
      else if (t.pk.length === 1 && t.pk[0] === c.col && c.type === 'UUID' && !t.fks.some((f) => f.col === c.col)) {
        props.push('defaultValue: DataTypes.UUIDV4');
      }
      const def = jsDefault(c);
      if (def !== null) props.push(`defaultValue: ${def}`);
      if (c.notNull && !t.pk.includes(c.col)) props.push('allowNull: false');
      if (props.length === 1 && !c.notNull) return `      ${c.col}: ${jsType(c)},`;
      return `      ${c.col}: { ${props.join(', ')} },`;
    });

  const opts = [`tableName: '${t.name}'`];
  if (!createdAt && !updatedAt) opts.push('timestamps: false');
  else {
    if (createdAt !== 'createdAt') opts.push(createdAt ? `createdAt: '${createdAt}'` : 'createdAt: false');
    if (!updatedAt) opts.push('updatedAt: false');
  }

  // belongsTo on this model; hasMany/hasOne are declared on the parent model.
  const assoc = t.fks.map((f) => `    ${t.name}.belongsTo(models.${f.parent}, { foreignKey: '${f.col}', as: '${f.col.replace(/Id$/, '')}' });`);
  for (const child of Object.values(tables)) {
    for (const f of child.fks.filter((fk) => fk.parent === t.name)) {
      const viaSelf = f.col === `${lcfirst(t.name)}Id`;
      const suffix = viaSelf ? '' : ucfirst(f.col.replace(/Id$/, ''));
      const method = f.unique ? 'hasOne' : 'hasMany';
      const as =
        ALIASES[`${t.name}.${child.name}.${f.col}`] ||
        (viaSelf && ALIASES[child.name]) ||
        (f.unique ? lcfirst(child.name) : plural(child.name)) + suffix;
      assoc.push(`    ${t.name}.${method}(models.${child.name}, { foreignKey: '${f.col}', as: '${as}' });`);
    }
  }

  const body = [
    '// Generated by scripts/generate-models.js from src/db/sql/schema.sql — do not edit by hand.',
    'module.exports = (sequelize, DataTypes) => {',
    `  const ${t.name} = sequelize.define(`,
    `    '${t.name}',`,
    '    {',
    ...attrs,
    '    },',
    `    { ${opts.join(', ')} },`,
    '  );',
    '',
  ];
  if (assoc.length) {
    body.push(`  ${t.name}.associate = (models) => {`, ...assoc, '  };', '');
  }
  body.push(`  return ${t.name};`, '};', '');

  const file = `${kebab(t.name)}.js`;
  fs.writeFileSync(path.join(outDir, file), body.join('\n'));
  files.push(file);
}

console.log(`Generated ${files.length} models:\n${files.map((f) => `  ${f}`).join('\n')}`);
console.log('\nRegister new/renamed files in src/db/models/index.js.');
