// Generates one typed Sequelize model per table (plus enums.ts) from src/db/sql/schema.sql.
// Usage: npm run db:models   (overwrites the generated files in src/db/models; media.ts and index.ts are untouched)
import fs from 'node:fs';
import path from 'node:path';

interface Column {
  col: string;
  type: string;
  notNull: boolean;
  def: string | null;
}
interface ForeignKey {
  col: string;
  parent: string;
  unique: boolean;
}
interface Table {
  name: string;
  columns: Column[];
  pk: string[];
  fks: ForeignKey[];
}

const root = path.join(import.meta.dirname, '..');
const sqlPath = path.join(root, 'src', 'db', 'sql', 'schema.sql');
const outDir = path.join(root, 'src', 'db', 'models');
const sql = fs.readFileSync(sqlPath, 'utf8');

const enums: Record<string, string[]> = {};
for (const m of sql.matchAll(/CREATE TYPE "(\w+)" AS ENUM \(([^)]*)\);/g)) {
  enums[m[1]!] = m[2]!.split(',').map((v) => v.trim());
}

const tables: Record<string, Table> = {};
for (const m of sql.matchAll(/CREATE TABLE "(\w+)" \(([\s\S]*?)\n\);/g)) {
  const name = m[1]!;
  const columns: Column[] = [];
  let pk: string[] = [];
  for (const raw of m[2]!.split('\n')) {
    const line = raw.trim().replace(/,$/, '');
    if (!line) continue;
    const pkm = line.match(/PRIMARY KEY \(([^)]*)\)/);
    if (pkm) {
      pk = pkm[1]!.split(',').map((c) => c.trim().replace(/"/g, ''));
      continue;
    }
    const cm = line.match(/^"(\w+)" ("?\w+"?(?: PRECISION)?(?:\(\d+\))?)(.*)$/);
    if (!cm) throw new Error(`Unparsed line in ${name}: ${line}`);
    const [, col, type, rest] = cm as unknown as [string, string, string, string];
    const def = rest.match(/DEFAULT (\S+)/);
    columns.push({ col, type, notNull: /NOT NULL/.test(rest), def: def ? def[1]! : null });
  }
  tables[name] = { name, columns, pk, fks: [] };
}

const uniqueCols = new Set<string>();
for (const m of sql.matchAll(/CREATE UNIQUE INDEX "\w+" ON "(\w+)"\("(\w+)"\);/g)) uniqueCols.add(`${m[1]}.${m[2]}`);

for (const m of sql.matchAll(/ALTER TABLE "(\w+)" ADD CONSTRAINT "\w+" FOREIGN KEY \("(\w+)"\) REFERENCES "(\w+)"\("(\w+)"\)/g)) {
  const [, child, col, parent] = m as unknown as [string, string, string, string];
  const t = tables[child]!;
  const isPkSingle = t.pk.length === 1 && t.pk[0] === col;
  t.fks.push({ col, parent, unique: isPkSingle || uniqueCols.has(`${child}.${col}`) });
}

const lcfirst = (s: string) => s[0]!.toLowerCase() + s.slice(1);
const ucfirst = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const PLURAL_OVERRIDES: Record<string, string> = { Staff: 'staff', FaceParameters: 'faceParameters', SchoolSettings: 'schoolSettings' };
function plural(model: string) {
  if (PLURAL_OVERRIDES[model]) return PLURAL_OVERRIDES[model];
  const s = lcfirst(model);
  if (/[^aeiou]y$/.test(s)) return s.slice(0, -1) + 'ies';
  if (/(s|sh|ch|x)$/.test(s)) return s + 'es';
  return s + 's';
}
// Readable aliases for hasMany/hasOne: by child model, or by "Parent.Child.fkColumn".
const ALIASES: Record<string, string> = {
  LevelSchedule: 'schedules',
  SchoolSettings: 'settings',
  PickupPhoto: 'photos',
  'Guardian.PickupCode.requestedById': 'requestedPickupCodes',
  'User.Alert.resolvedById': 'resolvedAlerts',
  'User.TimeEntry.recordedById': 'recordedTimeEntries',
  'User.Pickup.recordedById': 'recordedPickups',
  'User.FaceParameters.createdById': 'createdFaceParameters',
};
const kebab = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

const enumName = (c: Column) => c.type.match(/^"(\w+)"$/)?.[1];

function jsType(c: Column) {
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
  const e = enumName(c);
  if (e && enums[e]) return `DataTypes.ENUM(...${e})`;
  throw new Error(`Unknown type ${t}`);
}

function tsType(c: Column) {
  const t = c.type;
  if (t === 'UUID' || /^(VAR)?CHAR\(\d+\)$/.test(t) || t === 'DATE') return 'string';
  if (/^TIMESTAMPTZ\(\d+\)$/.test(t)) return 'Date';
  if (t === 'INTEGER' || t === 'SERIAL' || t === 'DOUBLE PRECISION') return 'number';
  if (t === 'BOOLEAN') return 'boolean';
  if (t === 'JSONB') return 'unknown';
  const e = enumName(c);
  if (e && enums[e]) return e;
  throw new Error(`Unknown type ${t}`);
}

function jsDefault(c: Column) {
  if (!c.def) return null;
  if (c.def === 'CURRENT_TIMESTAMP') return 'DataTypes.NOW';
  return c.def; // true/false, numbers and 'ENUM' literals are valid TS as-is
}

// Timestamp columns Sequelize manages itself (sets them on create/update).
function timestampsFor(t: Table) {
  const col = (n: string) => t.columns.find((c) => c.col === n);
  const createdAt = col('createdAt')?.def ? 'createdAt' : t.name === 'AuditLog' ? 'occurredAt' : null;
  const updatedAt = col('updatedAt') ? 'updatedAt' : null;
  return { createdAt, updatedAt };
}

const HEADER = '// Generated by scripts/generate-models.ts from src/db/sql/schema.sql — do not edit by hand.';

// Each DB enum becomes a runtime tuple plus a same-named union type.
const enumsFile = [HEADER, ''];
for (const [name, values] of Object.entries(enums)) {
  enumsFile.push(`export const ${name} = [${values.join(', ')}] as const;`, `export type ${name} = (typeof ${name})[number];`, '');
}
fs.writeFileSync(path.join(outDir, 'enums.ts'), enumsFile.join('\n'));

const files = ['enums.ts'];

for (const t of Object.values(tables)) {
  const { createdAt, updatedAt } = timestampsFor(t);
  const isPk = (c: Column) => t.pk.includes(c.col);
  const autoUuid = (c: Column) =>
    t.pk.length === 1 && t.pk[0] === c.col && c.type === 'UUID' && !t.fks.some((f) => f.col === c.col);

  const attrs = t.columns
    .filter((c) => c.col !== createdAt && c.col !== updatedAt)
    .map((c) => {
      const props = [`type: ${jsType(c)}`];
      if (isPk(c)) props.push('primaryKey: true');
      if (c.type === 'SERIAL') props.push('autoIncrement: true');
      else if (autoUuid(c)) props.push('defaultValue: DataTypes.UUIDV4');
      const def = jsDefault(c);
      if (def !== null) props.push(`defaultValue: ${def}`);
      if (c.notNull && !isPk(c)) props.push('allowNull: false');
      if (props.length === 1 && !c.notNull) return `      ${c.col}: ${jsType(c)},`;
      return `      ${c.col}: { ${props.join(', ')} },`;
    });

  const fields = t.columns.map((c) => `  ${c.col}: ${tsType(c)}${c.notNull || isPk(c) ? '' : ' | null'};`);
  // Optional on create: anything the DB or Sequelize fills in.
  const optional = t.columns
    .filter((c) => !c.notNull || c.def || c.type === 'SERIAL' || autoUuid(c) || c.col === createdAt || c.col === updatedAt)
    .map((c) => `'${c.col}'`);
  const usedEnums = [...new Set(t.columns.map(enumName).filter((e): e is string => !!e && !!enums[e]))];

  const opts = [`tableName: '${t.name}'`];
  if (!createdAt && !updatedAt) opts.push('timestamps: false');
  else {
    if (createdAt !== 'createdAt') opts.push(createdAt ? `createdAt: '${createdAt}'` : 'createdAt: false');
    if (!updatedAt) opts.push('updatedAt: false');
  }

  // belongsTo on this model; hasMany/hasOne are declared on the parent model.
  const assoc: string[] = [];
  const navs: string[] = [];
  const related = new Set<string>();
  for (const f of t.fks) {
    const as = f.col.replace(/Id$/, '');
    assoc.push(`      ${t.name}.belongsTo(models.${f.parent}, { foreignKey: '${f.col}', as: '${as}' });`);
    navs.push(`  ${as}?: NonAttribute<${f.parent}Instance>;`);
    related.add(f.parent);
  }
  for (const child of Object.values(tables)) {
    for (const f of child.fks.filter((fk) => fk.parent === t.name)) {
      const viaSelf = f.col === `${lcfirst(t.name)}Id`;
      const suffix = viaSelf ? '' : ucfirst(f.col.replace(/Id$/, ''));
      const method = f.unique ? 'hasOne' : 'hasMany';
      const as =
        ALIASES[`${t.name}.${child.name}.${f.col}`] ||
        (viaSelf && ALIASES[child.name]) ||
        (f.unique ? lcfirst(child.name) : plural(child.name)) + suffix;
      assoc.push(`      ${t.name}.${method}(models.${child.name}, { foreignKey: '${f.col}', as: '${as}' });`);
      navs.push(`  ${as}?: NonAttribute<${child.name}Instance${f.unique ? '' : '[]'}>;`);
      related.add(child.name);
    }
  }
  related.delete(t.name);

  // Sequelize fills the managed timestamps itself, so they're left out of the attribute definitions.
  const managed = [createdAt, updatedAt].filter((c): c is string => !!c).map((c) => `'${c}'`);
  const defineGeneric = managed.length
    ? `${t.name}Instance, Omit<${t.name}Attributes, ${managed.join(' | ')}>`
    : `${t.name}Instance`;

  const sequelizeTypes = ['type Model', 'type Optional', 'type Sequelize'];
  if (navs.length) sequelizeTypes.push('type NonAttribute');
  const body = [
    HEADER,
    `import { DataTypes, ${sequelizeTypes.join(', ')} } from 'sequelize';`,
  ];
  if (usedEnums.length) body.push(`import { ${usedEnums.join(', ')} } from './enums.ts';`);
  if (assoc.length) body.push("import type { Models } from './index.ts';");
  for (const r of [...related].sort()) body.push(`import type { ${r}Instance } from './${kebab(r)}.ts';`);
  // Self-references (e.g. a parent row of the same table) need the local interface, already in scope.
  body.push(
    '',
    `export interface ${t.name}Attributes {`,
    ...fields,
    '}',
    '',
    `export type ${t.name}CreationAttributes = Optional<${t.name}Attributes, ${optional.join(' | ') || 'never'}>;`,
    '',
    `export interface ${t.name}Instance extends Model<${t.name}Attributes, ${t.name}CreationAttributes>, ${t.name}Attributes {`,
    ...navs,
    '}',
    '',
    `export default function define${t.name}(sequelize: Sequelize) {`,
    `  const ${t.name} = sequelize.define<${defineGeneric}>(`,
    `    '${t.name}',`,
    '    {',
    ...attrs,
    '    },',
    `    { ${opts.join(', ')} },`,
    '  );',
    '',
  );
  if (assoc.length) {
    body.push(
      `  return Object.assign(${t.name}, {`,
      '    associate(models: Models) {',
      ...assoc,
      '    },',
      '  });',
    );
  } else {
    body.push(`  return ${t.name};`);
  }
  body.push('}', '');

  const file = `${kebab(t.name)}.ts`;
  fs.writeFileSync(path.join(outDir, file), body.join('\n'));
  files.push(file);
}

console.log(`Generated ${files.length} files:\n${files.map((f) => `  ${f}`).join('\n')}`);
console.log('\nRegister new/renamed models in src/db/models/index.ts.');
