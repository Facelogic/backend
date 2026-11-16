import { LevelType, PhotoServiceStatus } from "../../db/models/enums.ts";
import { Schedule } from "../../db/models/index.ts";
import type { ScheduleAttributes, ScheduleInstance } from "../../interfaces/models/schedule.interface.ts";
import type { SchoolInstance } from "../../interfaces/models/school.interface.ts";
import type { ScheduleInput, ScheduleItem, SchoolScheduleInput } from "../../interfaces/schedule.interface.ts";
import type { SchoolItem } from "../../interfaces/school.interface.ts";
import type { Transaction } from "sequelize";
import HttpError from "../../utils/http-error.ts";

type ScheduleChanges = Partial<Omit<ScheduleAttributes, 'id' | 'createdAt' | 'updatedAt'>>;

export function toItem(schedule: ScheduleInstance): ScheduleItem {
    return {
        id: schedule.id,
        level: schedule.level,
        school: schedule.schoolId,
        startTime: schedule.startTime.slice(0, 5),
        endTime: schedule.endTime.slice(0, 5),
    };
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

// "TIME" columns come back from Postgres as "HH:MM:SS" strings, so times are handled as text.
// Accepts "HH:MM" / "HH:MM:SS" or, for older clients, an ISO date-time (its UTC time is used).
function parseTime(field: string, raw: unknown): string {
    const value = String(raw ?? '').trim();
    const match = TIME_PATTERN.exec(value);
    if (match) return `${match[1]}:${match[2]}:${match[3] ?? '00'}`;

    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) throw new HttpError(400, `${field} debe ser una hora (HH:MM)`);
    return date.toISOString().slice(11, 19);
}

function handleWriteError(err: unknown): never {
    if (err instanceof HttpError) throw err;
    throw new HttpError(500, (err as Error).message);
}

function parseInput(input: ScheduleInput): ScheduleChanges {
    const changes: Record<string, unknown> = {};

    if (input.level !== undefined) {
        if (!LevelType.includes(input.level as LevelType)) {
            throw new HttpError(400, `level debe ser uno de ${LevelType.join(', ')}`);
        }
        changes.level = input.level;
    }
    
    if (input.schoolId !== undefined) {
        changes.schoolId = input.schoolId;
    }

    const startTime = input.startTime !== undefined ? parseTime('startTime', input.startTime) : undefined;
    const endTime = input.endTime !== undefined ? parseTime('endTime', input.endTime) : undefined;
    if (startTime !== undefined) changes.startTime = startTime;
    if (endTime !== undefined) changes.endTime = endTime;

    // Both are zero-padded "HH:MM:SS", so string comparison follows the clock.
    if (startTime !== undefined && endTime !== undefined && startTime >= endTime) {
        throw new HttpError(400, 'startTime debe ser anterior a endTime');
    }

    return changes as ScheduleChanges;
}

export async function create(input: ScheduleInput): Promise<ScheduleItem> {
    const changes = parseInput(input);
    const schedule = await Schedule.create(changes).catch(handleWriteError);
    return toItem(schedule);
}

export async function bulkCreate(inputs: unknown): Promise<ScheduleItem[]> {
    if (!Array.isArray(inputs)) {
        throw new HttpError(400, 'El cuerpo debe ser un arreglo');
    }

    const changes = inputs.map((input) => {
        if (input === null || typeof input !== 'object' || Array.isArray(input)) {
            throw new HttpError(400, 'Cada horario debe ser un objeto');
        }
        return parseInput(input as ScheduleInput);
    });

    const schedules = await Schedule.bulkCreate(changes).catch(handleWriteError);
    return schedules.map(toItem);
}

// Replaces the active schedules of a school with `inputs` (the full list, as sent by PUT /api/schools/:id):
// items with the `id` of an active schedule of the school are updated, items without `id` are created,
// and active schedules left out of the list are soft-deleted (status 0).
export async function syncBySchool(schoolId: string, inputs: unknown, transaction?: Transaction): Promise<void> {
    if (!Array.isArray(inputs)) throw new HttpError(400, 'schedules debe ser un arreglo');

    const current = await Schedule.findAll({ where: { schoolId, status: 1 }, transaction });
    const currentById = new Map(current.map((schedule) => [schedule.id, schedule]));
    const keptIds = new Set<string>();
    const toCreate: ScheduleChanges[] = [];
    const toUpdate: [ScheduleInstance, ScheduleChanges][] = [];

    for (const input of inputs) {
        if (input === null || typeof input !== 'object' || Array.isArray(input)) {
            throw new HttpError(400, 'Cada horario debe ser un objeto');
        }
        const { id, ...fields } = input as SchoolScheduleInput;
        for (const field of ['level', 'startTime', 'endTime'] as const) {
            if (fields[field] === undefined || fields[field] === null || fields[field] === '') {
                throw new HttpError(400, `${field} es obligatorio en cada horario`);
            }
        }
        const changes = parseInput({ level: fields.level, startTime: fields.startTime, endTime: fields.endTime, schoolId: undefined });

        if (id === undefined || id === null || id === '') {
            toCreate.push({ ...changes, schoolId });
            continue;
        }
        const schedule = currentById.get(String(id));
        if (!schedule) throw new HttpError(400, `El horario ${String(id)} no pertenece a este colegio o está inactivo`);
        if (keptIds.has(schedule.id)) throw new HttpError(400, `El horario ${schedule.id} está repetido`);
        keptIds.add(schedule.id);
        toUpdate.push([schedule, changes]);
    }

    try {
        const removedIds = current.filter((schedule) => !keptIds.has(schedule.id)).map((schedule) => schedule.id);
        if (removedIds.length) await Schedule.update({ status: 0 }, { where: { id: removedIds }, transaction });
        for (const [schedule, changes] of toUpdate) await schedule.update(changes, { transaction });
        if (toCreate.length) await Schedule.bulkCreate(toCreate, { transaction });
    } catch (err) {
        handleWriteError(err);
    }
}

// Soft delete of every active schedule of a school (status 0), used when the school is deactivated.
export async function removeBySchool(schoolId: string, transaction?: Transaction): Promise<number> {
    const [count] = await Schedule.update({ status: 0 }, { where: { schoolId, status: 1 }, transaction });
    return count;
}
