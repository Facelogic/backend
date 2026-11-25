import { ForeignKeyConstraintError, Op, UniqueConstraintError, type WhereOptions } from "sequelize";
import { ShiftType } from "../../db/models/enums.ts";
import { Shift, Staff, TimeEntry } from "../../db/models/index.ts";
import { isSuperadmin, resolveSchoolId } from "../../helper/school-scope.helper.ts";
import type { ShiftAttributes, ShiftCreationAttributes, ShiftInstance } from "../../interfaces/models/shift.interface.ts";
import type { UserInstance } from "../../interfaces/models/user.interface.ts";
import type { ShiftInput, ShiftItem, ShiftListFilters, ShiftSimpleItem } from "../../interfaces/shift.interface.ts";
import HttpError from "../../utils/http-error.ts";
import { parsePagination, toPaginated, type Paginated } from "../../utils/pagination.util.ts";
import { parseBoolean, parseInteger, parseTime } from "../../utils/parse.util.ts";
import { containsPattern, isUuid } from "../../utils/text.util.ts";

const MAX_GRACE_MIN = 240;

// Every shift of one school, only id and name (for selects/filters; Shift has no status column).
// APP_ADMIN / DOOR_STAFF always get their own school; a SUPERADMIN must send schoolId.
export async function listSimple(schoolIdParam: unknown, currentUser?: UserInstance): Promise<ShiftSimpleItem[]> {
    const schoolId = resolveSchoolId(currentUser, schoolIdParam);
    return Shift.findAll({
        where: { schoolId },
        attributes: ['id', 'name'],
        order: [['name', 'ASC'], ['id', 'ASC']],
        raw: true,
    });
}

const isBlank = (value: unknown) => value === undefined || value === null || String(value).trim() === '';

function parseType(value: unknown): ShiftType {
    const type = String(value ?? '').trim().toUpperCase() as ShiftType;
    if (!ShiftType.includes(type)) throw new HttpError(400, `type debe ser uno de ${ShiftType.join(', ')}`);
    return type;
}

// Rules:
// - name and type (FIXED | FLEXIBLE) are required.
// - FLEXIBLE: startTime and endTime (HH:mm) are required. FIXED: they are optional, but if one is sent so is the other.
// - includesBreak (default false): when true, breakStart, breakEnd and breakDeductionMin (minutes of rest) are
//   required; the break must fit inside the shift hours and the minutes can't exceed the break window.
//   When false the break fields are cleared.
// - graceMin: late tolerance in minutes (default 0). countOvertime: whether overtime is counted (default true).
function parseInput(input: ShiftInput): Omit<ShiftCreationAttributes, 'schoolId'> {
    const name = String(input.name ?? '').trim();
    if (!name) throw new HttpError(400, 'name es obligatorio');
    if (name.length > 60) throw new HttpError(400, 'name debe tener como máximo 60 caracteres');

    const type = parseType(input.type);

    let start: ReturnType<typeof parseTime> | null = null;
    let end: ReturnType<typeof parseTime> | null = null;
    if (type === 'FLEXIBLE' || !isBlank(input.startTime) || !isBlank(input.endTime)) {
        if (isBlank(input.startTime) || isBlank(input.endTime)) {
            throw new HttpError(400, type === 'FLEXIBLE'
                ? 'startTime y endTime son obligatorios para un turno FLEXIBLE'
                : 'startTime y endTime deben enviarse juntos');
        }
        start = parseTime('startTime', input.startTime);
        end = parseTime('endTime', input.endTime);
        if (end.minutes <= start.minutes) throw new HttpError(400, 'endTime debe ser posterior a startTime');
    }

    const includesBreak = isBlank(input.includesBreak) ? false : parseBoolean('includesBreak', input.includesBreak);
    let breakStart: string | null = null;
    let breakEnd: string | null = null;
    let breakDeductionMin = 0;
    if (includesBreak) {
        if (isBlank(input.breakStart) || isBlank(input.breakEnd) || isBlank(input.breakDeductionMin)) {
            throw new HttpError(400, 'breakStart, breakEnd y breakDeductionMin son obligatorios cuando includesBreak es true');
        }
        const bStart = parseTime('breakStart', input.breakStart);
        const bEnd = parseTime('breakEnd', input.breakEnd);
        if (bEnd.minutes <= bStart.minutes) throw new HttpError(400, 'breakEnd debe ser posterior a breakStart');
        if (start && end && (bStart.minutes < start.minutes || bEnd.minutes > end.minutes)) {
            throw new HttpError(400, 'El refrigerio debe estar dentro del horario del turno');
        }
        breakStart = bStart.text;
        breakEnd = bEnd.text;
        breakDeductionMin = parseInteger('breakDeductionMin', input.breakDeductionMin, 1, bEnd.minutes - bStart.minutes);
    }

    const graceMin = isBlank(input.graceMin) ? 0 : parseInteger('graceMin', input.graceMin, 0, MAX_GRACE_MIN);
    const countOvertime = isBlank(input.countOvertime) ? true : parseBoolean('countOvertime', input.countOvertime);

    return {
        name,
        type,
        startTime: start?.text ?? null,
        endTime: end?.text ?? null,
        breakStart,
        breakEnd,
        breakDeductionMin,
        graceMin,
        countOvertime,
    };
}

function toItem(shift: ShiftInstance): ShiftItem {
    return {
        id: shift.id,
        name: shift.name,
        type: shift.type,
        startTime: shift.startTime,
        endTime: shift.endTime,
        includesBreak: shift.breakStart !== null,
        breakStart: shift.breakStart,
        breakEnd: shift.breakEnd,
        breakDeductionMin: shift.breakDeductionMin,
        graceMin: shift.graceMin,
        countOvertime: shift.countOvertime,
    };
}

function handleWriteError(err: unknown): never {
    if (err instanceof HttpError) throw err;
    if (err instanceof UniqueConstraintError) throw new HttpError(409, 'Ya existe un turno con ese nombre en el colegio');
    if (err instanceof ForeignKeyConstraintError) throw new HttpError(400, 'Colegio no encontrado');
    throw new HttpError(500, (err as Error).message);
}

// Loads a shift the session user can manage: APP_ADMIN only those of its school (others answer 404).
async function findManageable(id: string, currentUser?: UserInstance): Promise<ShiftInstance> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const shift = isUuid(id) ? await Shift.findByPk(id) : null;
    if (!shift) throw new HttpError(404, 'Turno no encontrado');
    if (!isSuperadmin(currentUser) && shift.schoolId !== currentUser.schoolId) throw new HttpError(404, 'Turno no encontrado');
    return shift;
}

export async function get(id: string, currentUser?: UserInstance): Promise<ShiftItem> {
    return toItem(await findManageable(id, currentUser));
}

// Saves a shift for the school of the session user (SUPERADMIN: the schoolId in the body).
export async function create(input: ShiftInput, currentUser?: UserInstance): Promise<string> {
    const schoolId = resolveSchoolId(currentUser, input.schoolId);
    const data = parseInput(input);

    try {
        const shift = await Shift.create({ ...data, schoolId });
        return shift.id;
    } catch (err) {
        handleWriteError(err);
    }
}

// Partial update: the fields sent are merged over the current values and the whole shift is validated again
// with the same rules as create (e.g. switching to FLEXIBLE needs hours; includesBreak false clears the break).
// The school can't be changed.
export async function update(id: string, input: ShiftInput, currentUser?: UserInstance): Promise<void> {
    const shift = await findManageable(id, currentUser);
    const merged: ShiftInput = { ...toItem(shift) };
    for (const [key, value] of Object.entries(input) as [keyof ShiftInput, unknown][]) {
        if (key !== 'schoolId' && value !== undefined) merged[key] = value;
    }
    const data = parseInput(merged);

    try {
        await shift.update(data);
    } catch (err) {
        handleWriteError(err);
    }
}

// Hard delete (Shift has no status column). Refused while staff members are assigned to the shift or it has
// attendance records ("TimeEntry"."shiftId").
export async function remove(id: string, currentUser?: UserInstance): Promise<void> {
    const shift = await findManageable(id, currentUser);
    const assigned = await Staff.count({ where: { shiftId: shift.id } });
    if (assigned) throw new HttpError(409, `No se puede eliminar: el turno tiene ${assigned} miembro(s) del personal asignado(s)`);
    const entries = await TimeEntry.count({ where: { shiftId: shift.id } });
    if (entries) throw new HttpError(409, `No se puede eliminar: el turno tiene ${entries} asistencia(s) registrada(s)`);

    try {
        await shift.destroy();
    } catch (err) {
        if (err instanceof ForeignKeyConstraintError) throw new HttpError(409, 'No se puede eliminar: el turno tiene personal o asistencias asociadas');
        throw new HttpError(500, (err as Error).message);
    }
}

// Shifts of the session user's school (SUPERADMIN: ?schoolId=), by name, paginated.
// Optional filters: name (part of the name, case-insensitive) and type (FIXED | FLEXIBLE).
export async function list(filters: ShiftListFilters = {}, currentUser?: UserInstance): Promise<Paginated<ShiftItem>> {
    const schoolId = resolveSchoolId(currentUser, filters.schoolId);
    const { page, pageSize, limit, offset } = parsePagination(filters);

    const where: WhereOptions<ShiftAttributes> = { schoolId };
    const name = String(filters.name ?? '').trim();
    if (name) where.name = { [Op.iLike]: containsPattern(name) };
    if (!isBlank(filters.type)) where.type = parseType(filters.type);

    const { rows, count } = await Shift.findAndCountAll({
        where,
        order: [['name', 'ASC'], ['id', 'ASC']],
        limit,
        offset,
    });
    return toPaginated(rows.map(toItem), count, page, pageSize);
}
