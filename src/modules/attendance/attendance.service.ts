import { ForeignKeyConstraintError, Op, type WhereOptions } from "sequelize";
import { TimeEntrySource } from "../../db/models/enums.ts";
import { Shift, Staff, Station, TimeEntry, User } from "../../db/models/index.ts";
import { isSuperadmin, resolveSchoolId } from "../../helper/school-scope.helper.ts";
import {
    ATTENDANCE_STATUS_LABELS,
    AttendanceStatus,
    type AttendanceCreated,
    type AttendanceInput,
    type AttendanceListFilters,
    type AttendanceListItem,
} from "../../interfaces/attendance.interface.ts";
import type { ShiftInstance } from "../../interfaces/models/shift.interface.ts";
import type { TimeEntryAttributes, TimeEntryInstance } from "../../interfaces/models/time-entry.interface.ts";
import type { UserInstance } from "../../interfaces/models/user.interface.ts";
import { limaDate, limaDayStart, limaInstant, limaIsoDate, limaTime } from "../../utils/date.util.ts";
import HttpError from "../../utils/http-error.ts";
import { parsePagination, toPaginated, type Paginated } from "../../utils/pagination.util.ts";
import { parseBoolean } from "../../utils/parse.util.ts";
import { containsPattern, isUuid } from "../../utils/text.util.ts";

const MINUTE_MS = 60 * 1000;
const MAX_FUTURE_MS = 5 * MINUTE_MS; // clock skew tolerated for timestamps sent by a station
const MAX_ENTRY_MS = 24 * 60 * MINUTE_MS;

const isBlank = (value: unknown) => value === undefined || value === null || String(value).trim() === '';
const minutesBetween = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / MINUTE_MS);

// ---- Parsing helpers

function parseUuid(field: string, raw: unknown, required = false): string | null {
    const value = String(raw ?? '').trim();
    if (!value) {
        if (required) throw new HttpError(400, `${field} es obligatorio`);
        return null;
    }
    if (!isUuid(value)) throw new HttpError(400, `${field} inválido`);
    return value;
}

function parseText(field: string, raw: unknown, max: number): string | null {
    const value = String(raw ?? '').trim();
    if (!value) return null;
    if (value.length > max) throw new HttpError(400, `${field} debe tener como máximo ${max} caracteres`);
    return value;
}

function parseInstant(field: string, raw: unknown): Date | null {
    if (isBlank(raw)) return null;
    const date = new Date(String(raw).trim());
    if (Number.isNaN(date.getTime())) throw new HttpError(400, `${field} debe ser una fecha ISO 8601 válida`);
    if (date.getTime() > Date.now() + MAX_FUTURE_MS) throw new HttpError(400, `${field} no puede ser una fecha futura`);
    return date;
}

function parseConfidence(raw: unknown): number | null {
    if (isBlank(raw)) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new HttpError(400, 'confidence debe ser un número entre 0 y 100');
    return value;
}

function parseEnum<T extends string>(field: string, raw: unknown, values: readonly T[]): T | null {
    const value = String(raw ?? '').trim().toUpperCase();
    if (!value) return null;
    if (!(values as readonly string[]).includes(value)) throw new HttpError(400, `${field} debe ser uno de ${values.join(', ')}`);
    return value as T;
}

// "yyyy-mm-dd" (Lima day), validated; returned as is to compare with the DATE column.
function parseDay(field: string, raw: unknown): string | undefined {
    const value = String(raw ?? '').trim();
    if (!value) return undefined;
    if (!limaDayStart(value)) throw new HttpError(400, `${field} debe tener el formato yyyy-mm-dd`);
    return value;
}

// ---- Calculations (Lima time)

interface Computed {
    lateMin: number;
    workedMin: number | null;
    overtimeMin: number;
}

// - Lateness (FIXED shifts with startTime): minutes after the start, only when they exceed graceMin
//   (then the whole delay counts). FLEXIBLE shifts have no lateness.
// - Worked time: clock-out − clock-in, minus breakDeductionMin when the entry covers the whole break.
// - Overtime (only with countOvertime): FIXED → minutes after endTime; FLEXIBLE → worked time beyond the
//   scheduled time (endTime − startTime − breakDeductionMin).
export function computeTimes(shift: ShiftInstance, day: string, clockInAt: Date, clockOutAt: Date | null): Computed {
    let lateMin = 0;
    if (shift.type === 'FIXED' && shift.startTime) {
        const delay = minutesBetween(limaInstant(day, shift.startTime), clockInAt);
        if (delay > shift.graceMin) lateMin = delay;
    }
    if (!clockOutAt) return { lateMin, workedMin: null, overtimeMin: 0 };

    let workedMin = minutesBetween(clockInAt, clockOutAt);
    if (shift.breakStart && shift.breakEnd
        && clockInAt <= limaInstant(day, shift.breakStart) && clockOutAt >= limaInstant(day, shift.breakEnd)) {
        workedMin -= shift.breakDeductionMin;
    }
    workedMin = Math.max(0, workedMin);

    let overtimeMin = 0;
    if (shift.countOvertime && shift.endTime) {
        if (shift.type === 'FIXED') {
            overtimeMin = minutesBetween(limaInstant(day, shift.endTime), clockOutAt);
        } else if (shift.startTime) {
            const scheduled = minutesBetween(limaInstant(day, shift.startTime), limaInstant(day, shift.endTime)) - shift.breakDeductionMin;
            overtimeMin = workedMin - scheduled;
        }
    }
    return { lateMin, workedMin, overtimeMin: Math.max(0, overtimeMin) };
}

function statusOf(entry: Pick<TimeEntryAttributes, 'clockOutAt' | 'lateMin' | 'date'>): AttendanceStatus {
    if (!entry.clockOutAt) return entry.date >= limaIsoDate(new Date()) ? 'IN_PROGRESS' : 'INCOMPLETE';
    return entry.lateMin > 0 ? 'LATE' : 'ON_TIME';
}

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// ---- Create

// Records an attendance entry of a staff member of the school.
// Required: staffId and shiftId (and schoolId for SUPERADMIN, or it uses the school of the staff member's user). The shift is
// the one chosen when recording the attendance (not tied to the staff member); lateness, worked time and overtime
// are computed from it. clockInAt defaults to now; clockOutAt is optional. source defaults to STATION when
// stationId is sent, MANUAL otherwise; MANUAL needs manualReason.
export async function create(input: AttendanceInput, currentUser?: UserInstance): Promise<AttendanceCreated> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');

    const staffId = parseUuid('staffId', input.staffId, true)!;
    const staff = await Staff.findByPk(staffId, {
        attributes: ['id', 'active'],
        include: [{ model: User, as: 'user', attributes: ['schoolId'], required: true }],
    });
    const staffSchoolId = staff?.user?.schoolId;
    if (!staff || !staff.active || !staffSchoolId) throw new HttpError(404, 'Personal no encontrado');
    const schoolId = isSuperadmin(currentUser)
        ? resolveSchoolId(currentUser, isBlank(input.schoolId) ? staffSchoolId : input.schoolId)
        : resolveSchoolId(currentUser);
    if (staffSchoolId !== schoolId) throw new HttpError(404, 'Personal no encontrado');

    const shiftId = parseUuid('shiftId', input.shiftId, true)!;
    const shift = await Shift.findByPk(shiftId);
    if (!shift || shift.schoolId !== schoolId) throw new HttpError(400, 'Turno no encontrado en el colegio');

    const stationId = parseUuid('stationId', input.stationId);
    if (stationId) {
        const station = await Station.findByPk(stationId, { attributes: ['id', 'schoolId'] });
        if (!station || station.schoolId !== schoolId) throw new HttpError(400, 'Estación no encontrada en el colegio');
    }

    const source = parseEnum('source', input.source, TimeEntrySource) ?? (stationId ? 'STATION' : 'MANUAL');
    const manualReason = parseText('manualReason', input.manualReason, 120);
    if (source === 'MANUAL' && !manualReason) throw new HttpError(400, 'manualReason es obligatorio para un registro manual');
    const remarks = parseText('remarks', input.remarks, 300);
    const confidence = parseConfidence(input.confidence);

    const clockInAt = parseInstant('clockInAt', input.clockInAt) ?? new Date();
    const clockOutAt = parseInstant('clockOutAt', input.clockOutAt);
    if (clockOutAt) {
        if (clockOutAt <= clockInAt) throw new HttpError(400, 'clockOutAt debe ser posterior a clockInAt');
        if (clockOutAt.getTime() - clockInAt.getTime() > MAX_ENTRY_MS) throw new HttpError(400, 'Una asistencia no puede durar más de 24 horas');
    }

    // No overlap with another entry of the same person (an open entry counts until it is closed).
    const overlap = await TimeEntry.findOne({
        where: {
            staffId,
            ...(clockOutAt && { clockInAt: { [Op.lt]: clockOutAt } }),
            [Op.or]: [{ clockOutAt: null }, { clockOutAt: { [Op.gt]: clockInAt } }],
        },
        attributes: ['id'],
    });
    if (overlap) throw new HttpError(409, 'El personal ya tiene una asistencia abierta o que se cruza con ese horario');

    const date = limaIsoDate(clockInAt);
    const times = computeTimes(shift, date, clockInAt, clockOutAt);

    try {
        const entry = await TimeEntry.create({
            schoolId,
            staffId,
            stationId,
            date,
            clockInAt,
            clockOutAt,
            shiftId: shift.id,
            shiftName: shift.name,
            ...times,
            source,
            manualReason,
            remarks,
            confidence,
            recordedById: currentUser.id,
        });
        return { id: entry.id, ...times, status: statusOf(entry) };
    } catch (err) {
        if (err instanceof ForeignKeyConstraintError) throw new HttpError(400, 'Colegio, personal, turno o estación no encontrado');
        throw err;
    }
}

// ---- List

function buildWhere(filters: AttendanceListFilters, currentUser: UserInstance): WhereOptions<TimeEntryAttributes> {
    const conditions: WhereOptions<TimeEntryAttributes>[] = [];

    if (isSuperadmin(currentUser)) {
        const schoolId = parseUuid('schoolId', filters.schoolId);
        if (schoolId) conditions.push({ schoolId });
    } else {
        if (!currentUser.schoolId) throw new HttpError(403, 'La cuenta no tiene un colegio asignado');
        conditions.push({ schoolId: currentUser.schoolId });
    }

    const staffId = parseUuid('staffId', filters.staffId);
    if (staffId) conditions.push({ staffId });

    const shiftId = parseUuid('shiftId', filters.shiftId);
    if (shiftId) conditions.push({ shiftId });
    const shift = String(filters.shift ?? '').trim();
    if (shift) conditions.push({ shiftName: { [Op.iLike]: containsPattern(shift) } });

    const dateFrom = parseDay('dateFrom', filters.dateFrom);
    const dateTo = parseDay('dateTo', filters.dateTo);
    if (dateFrom && dateTo && dateFrom > dateTo) throw new HttpError(400, 'dateFrom no puede ser posterior a dateTo');
    if (dateFrom || dateTo) conditions.push({ date: { ...(dateFrom && { [Op.gte]: dateFrom }), ...(dateTo && { [Op.lte]: dateTo }) } });

    const today = limaIsoDate(new Date());
    const status = parseEnum('status', filters.status, AttendanceStatus);
    if (status === 'IN_PROGRESS') conditions.push({ clockOutAt: null, date: { [Op.gte]: today } });
    if (status === 'INCOMPLETE') conditions.push({ clockOutAt: null, date: { [Op.lt]: today } });
    if (status === 'LATE') conditions.push({ clockOutAt: { [Op.ne]: null }, lateMin: { [Op.gt]: 0 } });
    if (status === 'ON_TIME') conditions.push({ clockOutAt: { [Op.ne]: null }, lateMin: 0 });

    if (!isBlank(filters.late)) {
        conditions.push({ lateMin: parseBoolean('late', filters.late) ? { [Op.gt]: 0 } : 0 });
    }

    const name = String(filters.staffName ?? '').trim().replace(/\s+/g, ' ');
    if (name) conditions.push({ '$staff.user.name$': { [Op.iLike]: containsPattern(name) } } as WhereOptions<TimeEntryAttributes>);

    return { [Op.and]: conditions };
}

function toListItem(entry: TimeEntryInstance): AttendanceListItem {
    const status = statusOf(entry);
    return {
        id: entry.id,
        date: limaDate(entry.clockInAt),
        staffId: entry.staffId,
        staff: entry.staff?.user?.name ?? '',
        shiftId: entry.shiftId,
        shift: entry.shift?.name ?? entry.shiftName,
        clockInAt: entry.clockInAt.toISOString(),
        clockIn: limaTime(entry.clockInAt),
        clockOutAt: entry.clockOutAt?.toISOString() ?? null,
        clockOut: entry.clockOutAt ? limaTime(entry.clockOutAt) : null,
        isLate: entry.lateMin > 0,
        lateMin: entry.lateMin,
        workedMin: entry.workedMin,
        overtimeMin: entry.overtimeMin,
        overtime: hhmm(entry.overtimeMin),
        status,
        statusLabel: ATTENDANCE_STATUS_LABELS[status],
        remarks: entry.remarks,
        manualReason: entry.manualReason,
        source: entry.source,
        station: entry.station?.name ?? null,
    };
}

// Newest first, paginated. A non-SUPERADMIN only sees its own school (a schoolId in the query is ignored).
export async function list(filters: AttendanceListFilters = {}, currentUser?: UserInstance): Promise<Paginated<AttendanceListItem>> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const { page, pageSize, limit, offset } = parsePagination(filters);

    const { rows, count } = await TimeEntry.findAndCountAll({
        where: buildWhere(filters, currentUser),
        include: [
            {
                model: Staff,
                as: 'staff',
                attributes: ['id'],
                required: true,
                include: [{ model: User, as: 'user', attributes: ['name'], required: true }],
            },
            { model: Station, as: 'station', attributes: ['name'] },
            { model: Shift, as: 'shift', attributes: ['name'] },
        ],
        order: [['clockInAt', 'DESC'], ['id', 'ASC']],
        distinct: true,
        subQuery: false,
        limit,
        offset,
    });
    return toPaginated(rows.map(toListItem), count, page, pageSize);
}
