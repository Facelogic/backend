// Generates one typed Sequelize model per table (plus enums.ts) from src/db/sql/schema.sql (the CURRENT schema).
// Usage: npm run db:models   (overwrites the generated files in src/db/models and src/interfaces/models).
// Tables in HAND_WRITTEN keep their hand-written model (and index.ts is never touched); generated models still get
// the associations to them that come from foreign keys, plus the navigation props listed in EXTERNAL_NAVS.
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
const ifaceDir = path.join(root, 'src', 'interfaces', 'models');
fs.mkdirSync(ifaceDir, { recursive: true });
const sql = fs.readFileSync(sqlPath, 'utf8');

// ---- Configuration -------------------------------------------------------------------------------------------

// Tables whose model is written by hand: no file is generated for them.
// "media" also declares both sides of its associations itself, so its foreign keys are ignored here.
const HAND_WRITTEN = new Set(['media', 'Role', 'Menu', 'MenuRole', 'DocumentType', 'Schedule']);
const FKS_DECLARED_ELSEWHERE = new Set(['media']);

// Navigation props for associations declared in hand-written models (e.g. media.ts), so regenerating keeps them.
const EXTERNAL_NAVS: Record<string, { as: string; model: string; many: boolean }[]> = {
  School: [{ as: 'media', model: 'Media', many: true }],
  User: [{ as: 'media', model: 'Media', many: true }],
  Station: [{ as: 'media', model: 'Media', many: true }],
  // belongsToMany through ClassroomSchedule, declared in schedule.ts (hand-written).
  Classroom: [{ as: 'schedules', model: 'Schedule', many: true }],
};

// belongsTo navigation props typed as always present (their FK is NOT NULL and the code relies on them).
const REQUIRED_NAVS = new Set(['User.role']);

// SMALLINT status columns typed with an app constant (src/constants/<file>.ts) instead of a plain number.
const SMALLINT_CONSTANTS: Record<string, { name: string; file: string; def: string }> = {
  'School.status': { name: 'SchoolStatus', file: 'school-status', def: 'ACTIVE' },
  'Station.status': { name: 'StationStatus', file: 'station-status', def: 'ACTIVE' },
  'User.status': { name: 'UserStatus', file: 'user-status', def: 'INVITED' },
  'Classroom.status': { name: 'ClassroomStatus', file: 'classroom-status', def: 'ENABLED' },
};

// App-level enums with no DB enum type behind them (role codes, Schedule.level CHECK); appended to enums.ts.
const APP_ENUMS: Record<string, string[]> = {
  RoleFlag: ["'SUPERADMIN'", "'APP_ADMIN'", "'DOOR_STAFF'"],
  LevelType: ["'PRESCHOOL'", "'PRIMARY'", "'SECONDARY'"],
};

// ---- Parsing --------------------------------------------------------------------------------------------------

const enums: Record<string, string[]> = {};
for (const m of sql.matchAll(/CREATE TYPE "(\w+)" AS ENUM \(([^)]*)\);/g)) {
  // "enum_<table>_<column>" types are created by Sequelize for hand-written models (media).
  if (m[1]!.startsWith('enum_')) continue;
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
    const cm = line.match(/^"(\w+)" ("?\w+"?(?: PRECISION)?(?:\(\d+(?:,\s*\d+)?\))?)(.*)$/);
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
  if (FKS_DECLARED_ELSEWHERE.has(child)) continue;
  const t = tables[child]!;
  const isPkSingle = t.pk.length === 1 && t.pk[0] === col;
  t.fks.push({ col, parent, unique: isPkSingle || uniqueCols.has(`${child}.${col}`) });
}

// ---- Naming ---------------------------------------------------------------------------------------------------

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
// ("schedules" is the Schedule table's default alias; LevelSchedule uses its default, "levelSchedules".)
const ALIASES: Record<string, string> = {
  SchoolSettings: 'settings',
  PickupPhoto: 'photos',
  'Guardian.PickupCode.requestedById': 'requestedPickupCodes',
  'User.Alert.resolvedById': 'resolvedAlerts',
  'User.TimeEntry.recordedById': 'recordedTimeEntries',
  'User.Pickup.recordedById': 'recordedPickups',
  'User.FaceParameters.createdById': 'createdFaceParameters',
};
const kebab = (s: string) => s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

// ---- Types ----------------------------------------------------------------------------------------------------

const enumName = (c: Column) => c.type.match(/^"(\w+)"$/)?.[1];
const numericOf = (c: Column) => c.type.match(/^NUMERIC\((\d+),\s*(\d+)\)$/);

function jsType(c: Column) {
  const t = c.type;
  let m;
  if (t === 'UUID') return 'DataTypes.UUID';
  if ((m = t.match(/^VARCHAR\((\d+)\)$/))) return `DataTypes.STRING(${m[1]})`;
  if ((m = t.match(/^CHAR\((\d+)\)$/))) return `DataTypes.CHAR(${m[1]})`;
  if ((m = t.match(/^TIMESTAMPTZ\((\d+)\)$/))) return `DataTypes.DATE(${m[1]})`;
  if ((m = numericOf(c))) return `DataTypes.DECIMAL(${m[1]}, ${m[2]})`;
  if (t === 'DATE') return 'DataTypes.DATEONLY';
  if (t === 'TIME') return 'DataTypes.TIME';
  if (t === 'INTEGER' || t === 'SERIAL') return 'DataTypes.INTEGER';
  if (t === 'SMALLINT') return 'DataTypes.SMALLINT';
  if (t === 'BOOLEAN') return 'DataTypes.BOOLEAN';
  if (t === 'DOUBLE PRECISION') return 'DataTypes.DOUBLE';
  if (t === 'JSONB') return 'DataTypes.JSONB';
  const e = enumName(c);
  if (e && enums[e]) return `DataTypes.ENUM(...${e})`;
  throw new Error(`Unknown type ${t}`);
}

function tsType(t: Table, c: Column) {
  const constant = SMALLINT_CONSTANTS[`${t.name}.${c.col}`];
  if (constant) return constant.name;
  const type = c.type;
  if (type === 'UUID' || /^(VAR)?CHAR\(\d+\)$/.test(type) || type === 'DATE' || type === 'TIME') return 'string';
  if (/^TIMESTAMPTZ\(\d+\)$/.test(type)) return 'Date';
  if (['INTEGER', 'SERIAL', 'SMALLINT', 'DOUBLE PRECISION'].includes(type) || numericOf(c)) return 'number';
  if (type === 'BOOLEAN') return 'boolean';
  if (type === 'JSONB') return 'unknown';
  const e = enumName(c);
  if (e && enums[e]) return e;
  throw new Error(`Unknown type ${type}`);
}

function jsDefault(t: Table, c: Column) {
  if (!c.def) return null;
  const constant = SMALLINT_CONSTANTS[`${t.name}.${c.col}`];
  if (constant) return `${constant.name}.${constant.def}`;
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

// ---- enums.ts -------------------------------------------------------------------------------------------------

// Each DB enum becomes a runtime tuple plus a same-named union type; app enums go after them.
const enumsFile = [HEADER, ''];
const enumLines = (name: string, values: string[]) => [
  `export const ${name} = [${values.join(', ')}] as const;`,
  `export type ${name} = (typeof ${name})[number];`,
  '',
];
for (const [name, values] of Object.entries(enums)) enumsFile.push(...enumLines(name, values));
enumsFile.push('// App-level enums (no DB enum type): role codes ("Role"."code") and "Schedule"."level".', '');
for (const [name, values] of Object.entries(APP_ENUMS)) enumsFile.push(...enumLines(name, values));
fs.writeFileSync(path.join(outDir, 'enums.ts'), enumsFile.join('\n'));

const files = ['enums.ts'];

// ---- One model + interface per table --------------------------------------------------------------------------

for (const t of Object.values(tables)) {
  if (HAND_WRITTEN.has(t.name)) continue;

  const { createdAt, updatedAt } = timestampsFor(t);
  const isPk = (c: Column) => t.pk.includes(c.col);
  const autoUuid = (c: Column) =>
    t.pk.length === 1 && t.pk[0] === c.col && c.type === 'UUID' && !t.fks.some((f) => f.col === c.col);
  const numericCols = t.columns.filter((c) => numericOf(c));
  const precisions = new Set(numericCols.map((c) => c.type.replace(/\s/g, '')));
  if (precisions.size > 1) throw new Error(`${t.name}: NUMERIC columns with different precisions are not supported`);

  const attrs = t.columns
    .filter((c) => c.col !== createdAt && c.col !== updatedAt)
    .map((c) => {
      // NUMERIC: pg returns it as a string; the decimal() helper (below) parses it back to a number.
      if (numericOf(c)) return `      ${c.col}: decimal('${c.col}'${c.notNull ? '' : ', true'}),`;
      const props = [`type: ${jsType(c)}`];
      if (isPk(c)) props.push('primaryKey: true');
      if (c.type === 'SERIAL') props.push('autoIncrement: true');
      else if (autoUuid(c)) props.push('defaultValue: DataTypes.UUIDV4');
      const def = jsDefault(t, c);
      if (def !== null) props.push(`defaultValue: ${def}`);
      if (c.notNull && !isPk(c)) props.push('allowNull: false');
      if (!isPk(c) && uniqueCols.has(`${t.name}.${c.col}`)) props.push('unique: true');
      if (props.length === 1 && !c.notNull) return `      ${c.col}: ${jsType(c)},`;
      return `      ${c.col}: { ${props.join(', ')} },`;
    });

  const fields = t.columns.map((c) => `  ${c.col}: ${tsType(t, c)}${c.notNull || isPk(c) ? '' : ' | null'};`);
  // Optional on create: anything the DB or Sequelize fills in.
  const optional = t.columns
    .filter((c) => !c.notNull || c.def || c.type === 'SERIAL' || autoUuid(c) || c.col === createdAt || c.col === updatedAt)
    .map((c) => `'${c.col}'`);
  const usedEnums = [...new Set(t.columns.map(enumName).filter((e): e is string => !!e && !!enums[e]))];
  const usedConstants = t.columns
    .map((c) => SMALLINT_CONSTANTS[`${t.name}.${c.col}`])
    .filter((x): x is { name: string; file: string; def: string } => !!x);

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
    navs.push(`  ${as}${REQUIRED_NAVS.has(`${t.name}.${as}`) ? '' : '?'}: NonAttribute<${f.parent}Instance>;`);
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
  for (const nav of EXTERNAL_NAVS[t.name] ?? []) {
    navs.push(`  ${nav.as}?: NonAttribute<${nav.model}Instance${nav.many ? '[]' : ''}>;`);
    related.add(nav.model);
  }
  related.delete(t.name);

  // Sequelize fills the managed timestamps itself, so they're left out of the attribute definitions.
  const managed = [createdAt, updatedAt].filter((c): c is string => !!c).map((c) => `'${c}'`);
  const defineGeneric = managed.length
    ? `${t.name}Instance, Omit<${t.name}Attributes, ${managed.join(' | ')}>`
    : `${t.name}Instance`;

  // Types go to src/interfaces/models/<name>.interface.ts; the model file keeps only the runtime definition.
  const ifaceTypes = ['Model', ...(navs.length ? ['NonAttribute'] : []), 'Optional'];
  const iface = [HEADER, `import type { ${ifaceTypes.join(', ')} } from 'sequelize';`];
  for (const k of usedConstants) iface.push(`import type { ${k.name} } from '../../constants/${k.file}.ts';`);
  if (usedEnums.length) iface.push(`import type { ${usedEnums.join(', ')} } from '../../db/models/enums.ts';`);
  for (const r of [...related].sort()) iface.push(`import type { ${r}Instance } from './${kebab(r)}.interface.ts';`);
  // Self-references (e.g. a parent row of the same table) need the local interface, already in scope.
  iface.push(
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
  );
  fs.writeFileSync(path.join(ifaceDir, `${kebab(t.name)}.interface.ts`), iface.join('\n'));

  const needsAttributes = managed.length || numericCols.length;
  const modelTypes = needsAttributes ? `${t.name}Attributes, ${t.name}Instance` : `${t.name}Instance`;
  const body = [HEADER, "import { DataTypes, type Sequelize } from 'sequelize';"];
  for (const k of usedConstants) body.push(`import { ${k.name} } from '../../constants/${k.file}.ts';`);
  if (usedEnums.length) body.push(`import { ${usedEnums.join(', ')} } from './enums.ts';`);
  if (assoc.length) body.push("import type { Models } from './index.ts';");
  body.push(`import type { ${modelTypes} } from '../../interfaces/models/${kebab(t.name)}.interface.ts';`);
  if (numericCols.length) {
    const [, p, sc] = numericOf(numericCols[0]!)!;
    body.push(
      '',
      `// NUMERIC(${p},${sc}): at most ${sc} decimals. pg returns NUMERIC as a string, so the getter parses it back to a number.`,
      'function decimal(field: string, allowNull = false) {',
      '  return {',
      `    type: DataTypes.DECIMAL(${p}, ${sc}),`,
      '    allowNull,',
      `    get(this: ${t.name}Instance) {`,
      `      const raw = this.getDataValue(field as keyof ${t.name}Attributes) as unknown;`,
      '      return raw === null || raw === undefined ? raw : Number(raw);',
      '    },',
      '  };',
      '}',
    );
  }
  body.push(
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
console.log(`\nHand-written (not generated): ${[...HAND_WRITTEN].join(', ')}`);
console.log('Register new/renamed models in src/db/models/index.ts.');
