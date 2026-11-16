import { FaceParameters } from "../../db/models/index.ts";
import type { FaceParametersCreationAttributes, FaceParametersInstance } from "../../interfaces/models/face-parameters.interface.ts";
import {
    FACE_PARAMETERS_BOOLEAN_FIELDS,
    FACE_PARAMETERS_NUMERIC_FIELDS,
    type FaceParametersInput,
    type FaceParametersItem,
} from "../../interfaces/face-parameters.interface.ts";
import HttpError from "../../utils/http-error.ts";

// NUMERIC(12,4): at most 8 integer digits and 4 decimals.
const MAX_ABS = 1e8;
const MAX_DECIMALS = 4;

function parseNumber(field: string, raw: unknown): number {
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw.trim()) : NaN;
    if (!Number.isFinite(value)) throw new HttpError(400, `${field} debe ser un número`);
    if (Math.abs(value) >= MAX_ABS) throw new HttpError(400, `${field} debe ser menor que ${MAX_ABS}`);
    const decimals = (String(value).split('.')[1] ?? '').length;
    if (decimals > MAX_DECIMALS || String(value).includes('e')) {
        throw new HttpError(400, `${field} debe tener como máximo ${MAX_DECIMALS} decimales`);
    }
    return value;
}

function parseBoolean(field: string, raw: unknown): boolean {
    if (typeof raw === 'boolean') return raw;
    const value = String(raw ?? '').trim().toLowerCase();
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    throw new HttpError(400, `${field} debe ser un booleano`);
}

// Validates the fields present in the body. With partial = false (create) every numeric field is required.
function parseInput(input: FaceParametersInput, partial: boolean): Partial<FaceParametersCreationAttributes> {
    const changes: Record<string, number | boolean> = {};

    for (const field of FACE_PARAMETERS_NUMERIC_FIELDS) {
        const raw = input[field];
        if (raw === undefined || raw === null || raw === '') {
            if (partial && raw === undefined) continue;
            throw new HttpError(400, `${field} es obligatorio`);
        }
        changes[field] = parseNumber(field, raw);
    }

    for (const field of FACE_PARAMETERS_BOOLEAN_FIELDS) {
        const raw = input[field];
        if (raw === undefined) continue;
        changes[field] = parseBoolean(field, raw);
    }

    return changes as Partial<FaceParametersCreationAttributes>;
}

function toItem(row: FaceParametersInstance): FaceParametersItem {
    const item: Record<string, unknown> = { version: row.version };
    for (const field of FACE_PARAMETERS_NUMERIC_FIELDS) item[field] = row[field];
    for (const field of FACE_PARAMETERS_BOOLEAN_FIELDS) item[field] = row[field];
    return item as FaceParametersItem;
}

function parseVersion(raw: string): number {
    const version = Number(raw);
    if (!Number.isInteger(version) || version <= 0) throw new HttpError(400, 'Versión inválida');
    return version;
}

// Audit columns are not part of the response.
const itemAttributes = { exclude: ['createdById', 'createdAt'] };

// Latest version (highest "version"); if there is only one row, that one.
export async function getLatest(): Promise<FaceParametersItem> {
    const row = await FaceParameters.findOne({ attributes: itemAttributes, order: [['version', 'DESC']] });
    if (!row) throw new HttpError(404, 'Parámetros faciales no encontrados');
    return toItem(row);
}

export async function getByVersion(versionParam: string): Promise<FaceParametersItem> {
    const row = await FaceParameters.findByPk(parseVersion(versionParam), { attributes: itemAttributes });
    if (!row) throw new HttpError(404, 'Parámetros faciales no encontrados');
    return toItem(row);
}

// Creates a new version. Returns its version number.
export async function create(input: FaceParametersInput, createdById?: string): Promise<number> {
    const data = parseInput(input, false) as FaceParametersCreationAttributes;
    const row = await FaceParameters.create({ ...data, createdById: createdById ?? null });
    return row.version;
}

// Updates the given version in place; only the fields sent are changed.
export async function update(versionParam: string, input: FaceParametersInput): Promise<void> {
    const row = await FaceParameters.findByPk(parseVersion(versionParam));
    if (!row) throw new HttpError(404, 'Parámetros faciales no encontrados');

    const changes = parseInput(input, true);
    if (!Object.keys(changes).length) return;
    await row.update(changes);
}
