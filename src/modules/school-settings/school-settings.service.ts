import type { Transaction } from "sequelize";
import { CodeIssuer, CodeValidity } from "../../db/models/enums.ts";
import { School, SchoolSettings } from "../../db/models/index.ts";
import type { SchoolSettingsAttributes, SchoolSettingsInstance } from "../../interfaces/models/school-settings.interface.ts";
import type { UserInstance } from "../../interfaces/models/user.interface.ts";
import {
    APP_ADMIN_SETTINGS_FIELDS,
    SUPERADMIN_SETTINGS_FIELDS,
    type SchoolSettingsField,
    type SchoolSettingsInput,
    type SchoolSettingsItem,
} from "../../interfaces/school-settings.interface.ts";
import HttpError from "../../utils/http-error.ts";
import { isUuid } from "../../utils/text.util.ts";

type SettingsChanges = Partial<Omit<SchoolSettingsAttributes, 'schoolId' | 'updatedAt'>>;

const INT_MAX = 2_147_483_647;

// Validation rule of every editable field. Integers: minimum value allowed.
const RULES: Record<SchoolSettingsField, { type: 'boolean' } | { type: 'integer'; min: number } | { type: 'enum'; values: readonly string[] }> = {
    photoOnlyWithConsent: { type: 'boolean' },
    photoRetentionDays: { type: 'integer', min: 1 },
    unopenedMinutes: { type: 'integer', min: 1 },
    flagUnopened: { type: 'boolean' },
    disputeButtonEnabled: { type: 'boolean' },
    reminderEnabled: { type: 'boolean' },
    reminderMinutes: { type: 'integer', min: 1 },
    reminderRepeats: { type: 'integer', min: 0 },
    reminderIntervalMin: { type: 'integer', min: 1 },
    codeEnabled: { type: 'boolean' },
    codeValidity: { type: 'enum', values: CodeValidity },
    codesPerStudentPerDay: { type: 'integer', min: 1 },
    codeIssuer: { type: 'enum', values: CodeIssuer },
    attemptsBeforeLock: { type: 'integer', min: 1 },
    validateFaceOnArrival: { type: 'boolean' },
    notifyArrival: { type: 'boolean' },
    allowNationalId: { type: 'boolean' },
    notificationShowsValidation: { type: 'boolean' },
    notificationShowsPhoto: { type: 'boolean' },
};

function parseValue(field: SchoolSettingsField, raw: unknown): boolean | number | string {
    const rule = RULES[field];
    if (rule.type === 'boolean') {
        if (typeof raw === 'boolean') return raw;
        const value = String(raw ?? '').trim().toLowerCase();
        if (value === 'true' || value === '1') return true;
        if (value === 'false' || value === '0') return false;
        throw new HttpError(400, `${field} debe ser un booleano`);
    }
    if (rule.type === 'integer') {
        const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw.trim()) : NaN;
        if (!Number.isInteger(value) || value < rule.min || value > INT_MAX) {
            throw new HttpError(400, `${field} debe ser un entero mayor o igual a ${rule.min}`);
        }
        return value;
    }
    const value = String(raw ?? '').trim();
    if (!rule.values.includes(value)) throw new HttpError(400, `${field} debe ser uno de ${rule.values.join(', ')}`);
    return value;
}

// Only the fields of `allowed` present in the body are validated; anything else is ignored.
function parseInput(input: SchoolSettingsInput, allowed: readonly SchoolSettingsField[]): SettingsChanges {
    const changes: Record<string, unknown> = {};
    for (const field of allowed) {
        if (input[field] === undefined) continue;
        changes[field] = parseValue(field, input[field]);
    }
    return changes as SettingsChanges;
}

function toItem(settings: SchoolSettingsInstance): SchoolSettingsItem {
    return {
        schoolId: settings.schoolId,
        photoOnlyWithConsent: settings.photoOnlyWithConsent,
        flagUnopened: settings.flagUnopened,
        unopenedMinutes: settings.unopenedMinutes,
        disputeButtonEnabled: settings.disputeButtonEnabled,
        photoRetentionDays: settings.photoRetentionDays,
        reminderEnabled: settings.reminderEnabled,
        reminderMinutes: settings.reminderMinutes,
        reminderRepeats: settings.reminderRepeats,
        reminderIntervalMin: settings.reminderIntervalMin,
        codeEnabled: settings.codeEnabled,
        codeValidity: settings.codeValidity,
        codesPerStudentPerDay: settings.codesPerStudentPerDay,
        codeIssuer: settings.codeIssuer,
        attemptsBeforeLock: settings.attemptsBeforeLock,
        validateFaceOnArrival: settings.validateFaceOnArrival,
        notifyArrival: settings.notifyArrival,
        allowNationalId: settings.allowNationalId,
        notificationShowsValidation: settings.notificationShowsValidation,
        notificationShowsPhoto: settings.notificationShowsPhoto,
        updatedAt: settings.updatedAt.toISOString(),
    };
}

// Default settings row of a new school (called from schoolService.create, inside its transaction).
export async function createDefault(schoolId: string, transaction?: Transaction): Promise<void> {
    await SchoolSettings.create({ schoolId }, { transaction });
}

// Settings of the school; schools created before settings existed get their default row here.
async function findBySchool(schoolId: string): Promise<SchoolSettingsInstance> {
    if (!isUuid(schoolId)) throw new HttpError(404, 'Colegio no encontrado');
    const settings = await SchoolSettings.findByPk(schoolId);
    if (settings) return settings;

    if (!(await School.findByPk(schoolId, { attributes: ['id'] }))) throw new HttpError(404, 'Colegio no encontrado');
    const [created] = await SchoolSettings.findOrCreate({ where: { schoolId } });
    return created;
}

// School of the APP_ADMIN making the request.
function ownSchoolId(currentUser?: UserInstance): string {
    if (!currentUser?.schoolId) throw new HttpError(403, 'La cuenta no tiene un colegio asignado');
    return currentUser.schoolId;
}

async function applyChanges(schoolId: string, input: SchoolSettingsInput, allowed: readonly SchoolSettingsField[]): Promise<void> {
    const changes = parseInput(input, allowed);
    const settings = await findBySchool(schoolId);
    if (!Object.keys(changes).length) return;
    await settings.update(changes);
}

// SUPERADMIN: any school.
export async function getBySchool(schoolId: string): Promise<SchoolSettingsItem> {
    return toItem(await findBySchool(schoolId));
}

// SUPERADMIN: only the SUPERADMIN_SETTINGS_FIELDS.
export async function updateBySuperadmin(schoolId: string, input: SchoolSettingsInput): Promise<void> {
    await applyChanges(schoolId, input, SUPERADMIN_SETTINGS_FIELDS);
}

// APP_ADMIN: settings of their own school.
export async function getOwn(currentUser?: UserInstance): Promise<SchoolSettingsItem> {
    return toItem(await findBySchool(ownSchoolId(currentUser)));
}

// APP_ADMIN: only the APP_ADMIN_SETTINGS_FIELDS, for their own school.
export async function updateOwn(input: SchoolSettingsInput, currentUser?: UserInstance): Promise<string> {
    const schoolId = ownSchoolId(currentUser);
    await applyChanges(schoolId, input, APP_ADMIN_SETTINGS_FIELDS);
    return schoolId;
}
