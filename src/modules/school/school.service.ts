import { Op, UniqueConstraintError, type WhereOptions } from "sequelize";
import { SchoolStatus } from "../../constants/school-status.ts";
import { PhotoServiceStatus, RegistrationStatus } from "../../db/models/enums.ts";
import { School } from "../../db/models/index.ts";
import type { SchoolAttributes, SchoolCreationAttributes, SchoolInstance } from "../../interfaces/models/school.interface.ts";
import type { SchoolInput, SchoolItem, SchoolListFilters } from "../../interfaces/school.interface.ts";
import { formattedDate } from "../../utils/date.util.ts";
import HttpError from "../../utils/http-error.ts";
import { containsPattern, isUuid } from "../../utils/text.util.ts";

type SchoolChanges = Partial<Omit<SchoolAttributes, 'id' | 'createdAt' | 'updatedAt'>>;

// Text columns: max length = column size; `pattern` for the fixed-format ones.
const TEXT_FIELDS = {
    slug: { max: 40, required: true, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, hint: 'lowercase letters, digits and hyphens' },
    name: { max: 120, required: true },
    modularCode: { max: 7, required: true, pattern: /^\d{7}$/, hint: '7 digits' },
    taxId: { max: 11, required: true, pattern: /^\d{11}$/, hint: '11 digits (RUC)' },
    address: { max: 200, required: false },
    region: { max: 60, required: true },
    province: { max: 60, required: true },
    district: { max: 60, required: true },
    principalName: { max: 120, required: false },
    photoServiceNote: { max: 160, required: false },
} as const satisfies Record<string, { max: number; required: boolean; pattern?: RegExp; hint?: string }>;

const DATE_FIELDS = ['photoServiceSince', 'photoServiceCancelledAt', 'appPublishedAt', 'contractSignedAt'] as const;
const STATUS_VALUES = Object.values(SchoolStatus) as number[];
const STATUS_BY_VALUE = Object.fromEntries(Object.entries(SchoolStatus).map(([key, value]) => [value, key])) as Record<
    SchoolStatus,
    keyof typeof SchoolStatus
>;

// "Colegio San José" -> "colegio-san-jose"
const slugify = (text: string) =>
    text
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)
        .replace(/-+$/, '');

const isoOrNull = (date: Date | null) => (date ? date.toISOString() : null);

function toItem(school: SchoolInstance): SchoolItem {
    return {
        id: school.id,
        slug: school.slug,
        name: school.name,
        modularCode: school.modularCode,
        taxId: school.taxId,
        address: school.address,
        region: school.region,
        province: school.province,
        district: school.district,
        principalName: school.principalName,
        registrationStatus: school.registrationStatus,
        photoService: school.photoService,
        photoServiceSince: isoOrNull(school.photoServiceSince),
        photoServiceCancelledAt: isoOrNull(school.photoServiceCancelledAt),
        photoServiceNote: school.photoServiceNote,
        appPublishedAt: isoOrNull(school.appPublishedAt),
        contractSignedAt: isoOrNull(school.contractSignedAt),
        status: STATUS_BY_VALUE[school.status] ?? 'INACTIVE',
        createdDate: formattedDate(school.createdAt),
    };
}

// Validates the fields present in the body. With `partial` false (create) the required ones must be there.
function parseInput(input: SchoolInput, partial: boolean): SchoolChanges {
    const changes: Record<string, unknown> = {};

    for (const [field, rule] of Object.entries(TEXT_FIELDS) as [keyof typeof TEXT_FIELDS, (typeof TEXT_FIELDS)[keyof typeof TEXT_FIELDS]][]) {
        const raw = input[field];
        if (raw === undefined && partial) continue;
        const value = String(raw ?? '').trim();
        if (!value) {
            if (rule.required) throw new HttpError(400, `${field} is required`);
            changes[field] = null;
            continue;
        }
        if (value.length > rule.max) throw new HttpError(400, `${field} must have at most ${rule.max} characters`);
        if ('pattern' in rule && !rule.pattern.test(value)) throw new HttpError(400, `${field} must be ${rule.hint}`);
        changes[field] = value;
    }

    if (input.registrationStatus !== undefined) {
        if (!RegistrationStatus.includes(input.registrationStatus as RegistrationStatus)) {
            throw new HttpError(400, `registrationStatus must be one of ${RegistrationStatus.join(', ')}`);
        }
        changes.registrationStatus = input.registrationStatus;
    }
    if (input.photoService !== undefined) {
        if (!PhotoServiceStatus.includes(input.photoService as PhotoServiceStatus)) {
            throw new HttpError(400, `photoService must be one of ${PhotoServiceStatus.join(', ')}`);
        }
        changes.photoService = input.photoService;
    }

    for (const field of DATE_FIELDS) {
        const raw = input[field];
        if (raw === undefined) continue;
        if (raw === null || raw === '') {
            changes[field] = null;
            continue;
        }
        const date = new Date(String(raw));
        if (Number.isNaN(date.getTime())) throw new HttpError(400, `${field} must be a valid date (ISO 8601)`);
        changes[field] = date;
    }

    if (input.status !== undefined) {
        const status = Number(input.status);
        if (!STATUS_VALUES.includes(status)) throw new HttpError(400, `status must be one of ${STATUS_VALUES.join(', ')}`);
        changes.status = status;
    }

    return changes as SchoolChanges;
}

function handleWriteError(err: unknown): never {
    if (err instanceof HttpError) throw err;
    if (err instanceof UniqueConstraintError) {
        const field = err.errors[0]?.path;
        throw new HttpError(409, field === 'modularCode' ? 'Modular code already registered' : 'Slug already in use');
    }
    throw new HttpError(500, (err as Error).message);
}

async function findById(id: string) {
    const school = isUuid(id) ? await School.findByPk(id) : null;
    if (!school) throw new HttpError(404, 'School not found');
    return school;
}

// All schools, by name. Optional filters: `name` (part of the name, case-insensitive) and `status` (0 | 1).
export async function list(filters: SchoolListFilters = {}): Promise<SchoolItem[]> {
    const where: WhereOptions<SchoolAttributes> = {};

    const name = String(filters.name ?? '').trim();
    if (name) where.name = { [Op.iLike]: containsPattern(name) };

    const status = String(filters.status ?? '').trim();
    if (status) {
        const value = Number(status);
        if (!STATUS_VALUES.includes(value)) throw new HttpError(400, `status must be one of ${STATUS_VALUES.join(', ')}`);
        where.status = value as SchoolStatus;
    }
    const schools = await School.findAll({ where, order: [['name', 'ASC']] });
    return schools.map(toItem);
}

export async function get(id: string): Promise<SchoolItem> {
    return toItem(await findById(id));
}

// The slug is derived from the name when it isn't sent.
export async function create(input: SchoolInput): Promise<string> {
    const body = { ...input };
    if (body.slug === undefined || body.slug === null || String(body.slug).trim() === '') body.slug = slugify(String(body.name ?? ''));
    const data = parseInput(body, false);

    try {
        // parseInput(_, false) already required slug, name, modularCode, taxId, region, province and district.
        const school = await School.create(data as SchoolCreationAttributes);
        return school.id;
    } catch (err) {
        handleWriteError(err);
    }
}

export async function update(id: string, input: SchoolInput): Promise<void> {
    const school = await findById(id);
    const changes = parseInput(input, true);
    if (!Object.keys(changes).length) return;

    try {
        await school.update(changes);
    } catch (err) {
        handleWriteError(err);
    }
}

// Soft delete: students, pickups, time entries... reference the school (ON DELETE RESTRICT),
// so the row is kept and marked INACTIVE.
export async function remove(id: string): Promise<void> {
    const school = await findById(id);
    if (school.status !== SchoolStatus.INACTIVE) await school.update({ status: SchoolStatus.INACTIVE });
}
