import { parsePagination, toPaginated, type Paginated } from "../../utils/pagination.util.ts";
import { ForeignKeyConstraintError, Op, UniqueConstraintError, type WhereOptions } from "sequelize";
import { StationStatus } from "../../constants/station-status.ts";
import { School, Station } from "../../db/models/index.ts";
import type { StationAttributes, StationCreationAttributes, StationInstance } from "../../interfaces/models/station.interface.ts";
import type { StationInput, StationItem, StationListFilters, StationListItem, StationSimpleItem, StationStatusInput } from "../../interfaces/station.interface.ts";
import type { UserInstance } from "../../interfaces/models/user.interface.ts";
import { resolveSchoolId } from "../../helper/school-scope.helper.ts";
import { dateOrEmpty, statusLabel, textOrEmpty, type ExportRow } from "../../helper/export.helper.ts";
import { formattedDate } from "../../utils/date.util.ts";
import HttpError from "../../utils/http-error.ts";
import { containsPattern, isUuid } from "../../utils/text.util.ts";

type StationChanges = Partial<Omit<StationAttributes, 'id' | 'createdAt'>>;

// Text columns: max length = column size.
const TEXT_FIELDS = {
    name: { max: 80, required: true },
    code: { max: 20, required: true },
    version: { max: 20, required: false },
    serialNumber: { max: 60, required: false },
} as const satisfies Record<string, { max: number; required: boolean }>;

const STATUS_VALUES = Object.values(StationStatus) as number[];
const STATUS_BY_VALUE = Object.fromEntries(Object.entries(StationStatus).map(([key, value]) => [value, key])) as Record<
    StationStatus,
    keyof typeof StationStatus
>;
const statusKey = (status: StationStatus) => STATUS_BY_VALUE[status] ?? 'INACTIVE';

function parseStatus(value: unknown): StationStatus {
    const status = Number(String(value ?? '').trim());
    if (!STATUS_VALUES.includes(status)) throw new HttpError(400, `status debe ser uno de ${STATUS_VALUES.join(', ')}`);
    return status as StationStatus;
}

function toListItem(station: StationInstance): StationListItem {
    return {
        id: station.id,
        name: station.name,
        code: station.code,
        school: station.school?.name ?? '',
        // TODO: placeholders until the stations report them.
        version: '1.0.0',
        lastCommunication: '-',
        status: statusKey(station.status),
    };
}

function toItem(station: StationInstance): StationItem {
    return {
        id: station.id,
        name: station.name,
        code: station.code,
        schoolId: station.schoolId,
        school: station.school?.name ?? '',
        version: station.version,
        serialNumber: station.serialNumber,
        lastSyncAt: station.lastSyncAt ? station.lastSyncAt.toISOString() : null,
        status: statusKey(station.status),
        createdDate: formattedDate(station.createdAt),
    };
}

// Validates the fields present in the body. With partial = false (create) the required ones must be there.
function parseInput(input: StationInput, partial: boolean): StationChanges {
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
        changes[field] = value;
    }

    if (input.schoolId !== undefined || !partial) {
        const schoolId = String(input.schoolId ?? '').trim();
        if (!isUuid(schoolId)) throw new HttpError(400, 'schoolId inválido');
        changes.schoolId = schoolId;
    }

    if (input.status !== undefined) changes.status = parseStatus(input.status);

    return changes as StationChanges;
}

function handleWriteError(err: unknown): never {
    if (err instanceof HttpError) throw err;
    if (err instanceof UniqueConstraintError) throw new HttpError(409, 'El código de estación ya está registrado');
    if (err instanceof ForeignKeyConstraintError) throw new HttpError(400, 'Colegio no encontrado');
    throw new HttpError(500, (err as Error).message);
}

const schoolInclude = { model: School, as: 'school', attributes: ['name'] };

async function findById(id: string) {
    const station = isUuid(id) ? await Station.findByPk(id, { include: [schoolInclude] }) : null;
    if (!station) throw new HttpError(404, 'Estación no encontrada');
    return station;
}

// Filters shared by list and exportAll: name (part of the name, case-insensitive), schoolId and status (0 | 1).
function buildWhere(filters: StationListFilters): WhereOptions<StationAttributes> {
    const where: WhereOptions<StationAttributes> = {};

    const name = String(filters.name ?? '').trim();
    if (name) where.name = { [Op.iLike]: containsPattern(name) };

    const schoolId = String(filters.schoolId ?? '').trim();
    if (schoolId) {
        if (!isUuid(schoolId)) throw new HttpError(400, 'schoolId inválido');
        where.schoolId = schoolId;
    }

    if (String(filters.status ?? '').trim()) where.status = parseStatus(filters.status);
    return where;
}

// All stations, by name, paginated.
export async function list(filters: StationListFilters = {}): Promise<Paginated<StationListItem>> {
    const { page, pageSize, limit, offset } = parsePagination(filters);
    const where = buildWhere(filters);

    const { rows, count } = await Station.findAndCountAll({
        where,
        include: [schoolInclude],
        order: [['name', 'ASC'], ['id', 'ASC']],
        distinct: true,
        limit,
        offset,
    });
    return toPaginated(rows.map(toListItem), count, page, pageSize);
}

// Active stations of one school, only id and name (for selects/filters). APP_ADMIN / DOOR_STAFF always get
// their own school; a SUPERADMIN must send schoolId.
export async function listSimple(schoolIdParam: unknown, currentUser?: UserInstance): Promise<StationSimpleItem[]> {
    const schoolId = resolveSchoolId(currentUser, schoolIdParam);
    return Station.findAll({
        where: { schoolId, status: StationStatus.ACTIVE },
        attributes: ['id', 'name'],
        order: [['name', 'ASC'], ['id', 'ASC']],
        raw: true,
    });
}

export async function get(id: string): Promise<StationItem> {
    return toItem(await findById(id));
}

// New stations always start ACTIVE; a "status" in the body is ignored.
export async function create(input: StationInput): Promise<string> {
    const data = parseInput({ ...input, status: undefined }, false);
    data.status = StationStatus.ACTIVE;
    try {
        const station = await Station.create(data as StationCreationAttributes);
        return station.id;
    } catch (err) {
        handleWriteError(err);
    }
}

export async function update(id: string, input: StationInput): Promise<void> {
    const station = await findById(id);
    const changes = parseInput(input, true);
    if (!Object.keys(changes).length) return;

    try {
        await station.update(changes);
    } catch (err) {
        handleWriteError(err);
    }
}

// Soft delete: arrivals, pickups and time entries keep pointing at the station, so it is only marked INACTIVE.
export async function remove(id: string): Promise<void> {
    const station = await findById(id);
    if (station.status !== StationStatus.INACTIVE) await station.update({ status: StationStatus.INACTIVE });
}

// Changes only the status (0 = INACTIVE, 1 = ACTIVE).
export async function changeStatus(id: string, input: StationStatusInput): Promise<void> {
    const raw = input.status;
    if (raw === undefined || raw === null || String(raw).trim() === '') throw new HttpError(400, 'status es obligatorio');
    const status = parseStatus(raw);
    const station = await findById(id);
    if (station.status !== status) await station.update({ status });
}

// Every station matching the list filters (no pagination), as rows ready for an Excel sheet.
export async function exportAll(filters: StationListFilters = {}): Promise<ExportRow[]> {
    const stations = await Station.findAll({
        where: buildWhere(filters),
        include: [schoolInclude],
        order: [['name', 'ASC'], ['id', 'ASC']],
    });
    return stations.map((station) => ({
        'Nombre': station.name,
        'Código': station.code,
        'Colegio': station.school?.name ?? '',
        'Versión': textOrEmpty(station.version),
        'Número de serie': textOrEmpty(station.serialNumber),
        'Última sincronización': dateOrEmpty(station.lastSyncAt),
        'Estado': statusLabel(station.status),
        'Fecha de registro': dateOrEmpty(station.createdAt),
    }));
}
