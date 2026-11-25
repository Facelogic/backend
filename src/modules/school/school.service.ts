import { parsePagination, toPaginated, type Paginated } from "../../utils/pagination.util.ts";
import { Op, UniqueConstraintError, type WhereOptions } from "sequelize";
import { SchoolStatus } from "../../constants/school-status.ts";
import { StationStatus } from "../../constants/station-status.ts";
import { PhotoServiceStatus } from "../../db/models/enums.ts";
import { Schedule, School, sequelize } from "../../db/models/index.ts";
import type { SchoolAttributes, SchoolCreationAttributes, SchoolInstance } from "../../interfaces/models/school.interface.ts";
import type { SchoolInput, SchoolItem, SchoolListFilters, SchoolOption, SchoolStatusInput } from "../../interfaces/school.interface.ts";
import { parsePhone } from "../../helper/phone.helper.ts";
import { dateOrEmpty, PHOTO_SERVICE_LABELS, statusLabel, textOrEmpty, type ExportRow } from "../../helper/export.helper.ts";
import { formattedDate } from "../../utils/date.util.ts";
import HttpError from "../../utils/http-error.ts";
import { containsPattern, isUuid } from "../../utils/text.util.ts";
import type { ScheduleInput } from "../../interfaces/schedule.interface.ts";
import * as scheduleService from '../schedule/schedule.service.ts';
import * as schoolSettingsService from '../school-settings/school-settings.service.ts';


type SchoolChanges = Partial<Omit<SchoolAttributes, 'id' | 'createdAt' | 'updatedAt'>>;

// Text columns: max length = column size; `pattern` for the fixed-format ones.
const TEXT_FIELDS = {
    slug: { max: 40, required: true, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, hint: 'letras minúsculas, dígitos y guiones' },
    name: { max: 120, required: true },
    modularCode: { max: 7, required: true, pattern: /^\d{7}$/, hint: '7 dígitos' },
    taxId: { max: 11, required: true, pattern: /^\d{11}$/, hint: '11 dígitos (RUC)' },
    address: { max: 200, required: false },
    region: { max: 60, required: true },
    province: { max: 60, required: true },
    district: { max: 60, required: true },
    photoServiceNote: { max: 160, required: false },
} as const satisfies Record<string, { max: number; required: boolean; pattern?: RegExp; hint?: string }>;

const DATE_FIELDS = ['photoServiceSince', 'photoServiceCancelledAt', 'appPublishedAt', 'contractSignedAt'] as const;
const STATUS_VALUES = Object.values(SchoolStatus) as number[];
const STATUS_BY_VALUE = Object.fromEntries(Object.entries(SchoolStatus).map(([key, value]) => [value, key])) as Record<
    SchoolStatus,
    keyof typeof SchoolStatus
>;

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

// Station counts of each school as extra columns (subqueries, no rows loaded):
// `stationCount` = active stations, `totalStationCount` = all of them, active or not.
const STATION_COUNTS = [
    [
        sequelize.literal(
            `(SELECT COUNT(*)::int FROM "Station" WHERE "Station"."schoolId" = "School"."id" AND "Station"."status" = ${StationStatus.ACTIVE})`,
        ),
        'stationCount',
    ],
    [
        sequelize.literal('(SELECT COUNT(*)::int FROM "Station" WHERE "Station"."schoolId" = "School"."id")'),
        'totalStationCount',
    ],
] as const;

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
        phone: school.phone,
        photoService: school.photoService,
        photoServiceSince: isoOrNull(school.photoServiceSince),
        photoServiceCancelledAt: isoOrNull(school.photoServiceCancelledAt),
        photoServiceNote: school.photoServiceNote,
        appPublishedAt: isoOrNull(school.appPublishedAt),
        contractSignedAt: isoOrNull(school.contractSignedAt),
        status: STATUS_BY_VALUE[school.status] ?? 'INACTIVE',
        createdDate: formattedDate(school.createdAt),
        stationCount: Number(school.get('stationCount') ?? 0),
        totalStationCount: Number(school.get('totalStationCount') ?? 0),
        ...(school.schedules && { schedules: school.schedules.map(scheduleService.toItem) }),
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
            if (rule.required) throw new HttpError(400, `${field} es obligatorio`);
            changes[field] = null;
            continue;
        }
        if (value.length > rule.max) throw new HttpError(400, `${field} debe tener como máximo ${rule.max} caracteres`);
        if ('pattern' in rule && !rule.pattern.test(value)) throw new HttpError(400, `${field} debe contener ${rule.hint}`);
        changes[field] = value;
    }

    if (input.phone !== undefined) changes.phone = parsePhone(input.phone);

    if (input.photoService !== undefined) {
        if (!PhotoServiceStatus.includes(input.photoService as PhotoServiceStatus)) {
            throw new HttpError(400, `photoService debe ser uno de ${PhotoServiceStatus.join(', ')}`);
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
        if (Number.isNaN(date.getTime())) throw new HttpError(400, `${field} debe ser una fecha válida (ISO 8601)`);
        changes[field] = date;
    }

    if (input.status !== undefined) {
        const status = Number(input.status);
        if (!STATUS_VALUES.includes(status)) throw new HttpError(400, `status debe ser uno de ${STATUS_VALUES.join(', ')}`);
        changes.status = status;
    }

    return changes as SchoolChanges;
}

function handleWriteError(err: unknown): never {
    if (err instanceof HttpError) throw err;
    if (err instanceof UniqueConstraintError) {
        const field = err.errors[0]?.path;
        throw new HttpError(409, field === 'modularCode' ? 'El código modular ya está registrado' : 'El slug ya está en uso');
    }
    throw new HttpError(500, (err as Error).message);
}

// Loads the school with its active schedules (status 1), ordered by level.
async function findById(id: string) {
    const school = isUuid(id)
        ? await School.findByPk(id, {
              attributes: { include: [...STATION_COUNTS] },
              include: [{ model: Schedule, as: 'schedules', where: { status: 1 }, required: false }],
              order: [[{ model: Schedule, as: 'schedules' }, 'level', 'ASC']],
          })
        : null;
    if (!school) throw new HttpError(404, 'Colegio no encontrado');
    return school;
}

// Filters shared by list and exportAll: `name` (part of the name, case-insensitive) and `status` (0 | 1).
function buildWhere(filters: SchoolListFilters): WhereOptions<SchoolAttributes> {
    const where: WhereOptions<SchoolAttributes> = {};

    const name = String(filters.name ?? '').trim();
    if (name) where.name = { [Op.iLike]: containsPattern(name) };

    const status = String(filters.status ?? '').trim();
    if (status) {
        const value = Number(status);
        if (!STATUS_VALUES.includes(value)) throw new HttpError(400, `status debe ser uno de ${STATUS_VALUES.join(', ')}`);
        where.status = value as SchoolStatus;
    }
    return where;
}

// All schools, by name, paginated.
export async function list(filters: SchoolListFilters = {}): Promise<Paginated<SchoolItem>> {
    const { page, pageSize, limit, offset } = parsePagination(filters);
    const where = buildWhere(filters);
    const { rows, count } = await School.findAndCountAll({
        where,
        attributes: { include: [...STATION_COUNTS] },
        order: [['name', 'ASC'], ['id', 'ASC']],
        limit,
        offset,
    });
    // TODO: placeholders until these values are computed; only sent in the list.
    const items = rows.map((school) => ({ ...toItem(school), sendPhotos: '-', consentingAdults: 0, lastSync: '-' }));
    return toPaginated(items, count, page, pageSize);
}

// Every school matching the list filters (no pagination), as rows ready for an Excel sheet.
export async function exportAll(filters: SchoolListFilters = {}): Promise<ExportRow[]> {
    const schools = await School.findAll({
        where: buildWhere(filters),
        attributes: { include: [...STATION_COUNTS] },
        order: [['name', 'ASC'], ['id', 'ASC']],
    });
    return schools.map((school) => ({
        'Nombre': school.name,
        'Slug': school.slug,
        'Código modular': school.modularCode,
        'RUC': school.taxId,
        'Dirección': textOrEmpty(school.address),
        'Región': school.region,
        'Provincia': school.province,
        'Distrito': school.district,
        'Teléfono': textOrEmpty(school.phone),
        'Servicio de fotos': PHOTO_SERVICE_LABELS[school.photoService] ?? school.photoService,
        'Estaciones activas': Number(school.get('stationCount') ?? 0),
        'Estaciones totales': Number(school.get('totalStationCount') ?? 0),
        'Estado': statusLabel(school.status),
        'Fecha de registro': dateOrEmpty(school.createdAt),
    }));
}

// Active schools, only id and name, by name (for selectors).
export async function listSimple(): Promise<SchoolOption[]> {
    const schools = await School.findAll({
        attributes: ['id', 'name'],
        where: { status: SchoolStatus.ACTIVE },
        order: [['name', 'ASC']],
    });
    return schools.map(({ id, name }) => ({ id, name }));
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
        // The school, its default settings row and its schedules are created together. Each schedule is linked to
        // the classrooms of the school with the same level (none yet on a new school; classrooms created later get
        // them from classroomService, see scheduleService.syncClassroomLinks).
        const school = await sequelize.transaction(async (transaction) => {
            const created = await School.create(data as SchoolCreationAttributes, { transaction });
            await schoolSettingsService.createDefault(created.id, transaction);
            if (Array.isArray(body.schedules) && body.schedules.length) {
                const schedules = (body.schedules as ScheduleInput[]).map((schedule) => ({
                    ...schedule,
                    schoolId: created.id,
                }));
                await scheduleService.bulkCreate(schedules, transaction);
            }
            return created;
        });

        return school.id;
    } catch (err) {
        handleWriteError(err);
    }
}

export async function update(id: string, input: SchoolInput): Promise<void> {
    const school = await findById(id);
    // The status is only changed through PATCH /api/schools/:id/status (it also handles the schedules), so it's ignored here.
    const { status: _status, ...fields } = input;
    const changes = parseInput(fields, true);
    // `schedules` omitted (or null) leaves them as they are; an array replaces them (see scheduleService.syncBySchool).
    const schedules = input.schedules ?? undefined;
    if (!Object.keys(changes).length && schedules === undefined) return;

    try {
        await sequelize.transaction(async (transaction) => {
            if (Object.keys(changes).length) await school.update(changes, { transaction });
            if (schedules !== undefined) await scheduleService.syncBySchool(school.id, schedules, transaction);
        });
    } catch (err) {
        handleWriteError(err);
    }
}

// Changes only the status (0 = INACTIVE, 1 = ACTIVE). Deactivating also deactivates the school's schedules,
// like `remove`; activating doesn't bring them back (they are set again through PUT /api/schools/:id).
export async function changeStatus(id: string, input: SchoolStatusInput): Promise<void> {
    const raw = input.status;
    const status = raw === undefined || raw === null || String(raw).trim() === '' ? NaN : Number(raw);
    if (!STATUS_VALUES.includes(status)) throw new HttpError(400, `status debe ser uno de ${STATUS_VALUES.join(', ')}`);

    const school = await findById(id);
    await sequelize.transaction(async (transaction) => {
        if (school.status !== status) await school.update({ status: status as SchoolStatus }, { transaction });
        if (status === SchoolStatus.INACTIVE) await scheduleService.removeBySchool(school.id, transaction);
    });
}

// Soft delete: students, pickups, time entries... reference the school (ON DELETE RESTRICT),
// so the row is kept and marked INACTIVE, together with its schedules.
export async function remove(id: string): Promise<void> {
    const school = await findById(id);
    await sequelize.transaction(async (transaction) => {
        if (school.status !== SchoolStatus.INACTIVE) await school.update({ status: SchoolStatus.INACTIVE }, { transaction });
        await scheduleService.removeBySchool(school.id, transaction);
    });
}
