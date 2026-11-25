import { ForeignKeyConstraintError, literal, Op, UniqueConstraintError, type Includeable, type WhereOptions } from "sequelize";
import { ClassroomStatus } from "../../constants/classroom-status.ts";
import { Classroom, sequelize, Staff, Student, User } from "../../db/models/index.ts";
import { syncClassroomLinks } from "../schedule/schedule.service.ts";
import { parseLevel } from "../../helper/level.helper.ts";
import { isSuperadmin, resolveSchoolId } from "../../helper/school-scope.helper.ts";
import {
    CLASSROOM_STATUS_LABELS,
    type ClassroomDetail,
    type ClassroomInput,
    type ClassroomListFilters,
    type ClassroomListItem,
} from "../../interfaces/classroom.interface.ts";
import type { ClassroomAttributes, ClassroomInstance } from "../../interfaces/models/classroom.interface.ts";
import type { UserInstance } from "../../interfaces/models/user.interface.ts";
import HttpError from "../../utils/http-error.ts";
import { parsePagination, toPaginated, type Paginated } from "../../utils/pagination.util.ts";
import { parseInteger } from "../../utils/parse.util.ts";
import { containsPattern, isUuid } from "../../utils/text.util.ts";

type ClassroomChanges = Partial<Pick<ClassroomAttributes, 'name' | 'level' | 'grade' | 'section' | 'staffId' | 'capacity' | 'status'>>;

const MAX_CAPACITY = 1000;
const STATUS_VALUES = Object.values(ClassroomStatus) as number[];

const isBlank = (value: unknown) => value === undefined || value === null || String(value).trim() === '';

// Text columns (all required): max length = column size.
const TEXT_FIELDS = { name: 60, grade: 20, section: 10 } as const;

// Students linked to the classroom, as an extra attribute of the query.
const STUDENT_COUNT = literal('(SELECT COUNT(*)::int FROM "Student" s WHERE s."classroomId" = "Classroom"."id")');

// Tutor (staff member) with the name of its user. With a tutor name filter both joins become required.
function tutorInclude(tutorName?: string): Includeable {
    return {
        model: Staff,
        as: 'staff',
        attributes: ['id'],
        required: Boolean(tutorName),
        include: [{
            model: User,
            as: 'user',
            attributes: ['name'],
            required: Boolean(tutorName),
            ...(tutorName && { where: { name: { [Op.iLike]: containsPattern(tutorName) } } }),
        }],
    };
}

// ---- Parsing

function parseStatus(value: unknown): ClassroomStatus {
    const status = isBlank(value) ? NaN : Number(value);
    if (!STATUS_VALUES.includes(status)) {
        throw new HttpError(400, `status debe ser uno de ${STATUS_VALUES.join(', ')} (0 = inhabilitado, 1 = habilitado)`);
    }
    return status as ClassroomStatus;
}

// Validates the fields present in the body. With partial = false (create) the required ones must be there.
function parseInput(input: ClassroomInput, partial: boolean): ClassroomChanges {
    const changes: ClassroomChanges = {};

    for (const [field, max] of Object.entries(TEXT_FIELDS) as [keyof typeof TEXT_FIELDS, number][]) {
        if (input[field] === undefined && partial) continue;
        const value = String(input[field] ?? '').trim();
        if (!value) throw new HttpError(400, `${field} es obligatorio`);
        if (value.length > max) throw new HttpError(400, `${field} debe tener como máximo ${max} caracteres`);
        changes[field] = value;
    }

    if (input.level !== undefined || !partial) changes.level = parseLevel(input.level);

    if (input.staffId !== undefined) {
        const staffId = String(input.staffId ?? '').trim();
        if (staffId && !isUuid(staffId)) throw new HttpError(400, 'staffId inválido');
        changes.staffId = staffId || null;
    }

    if (input.capacity !== undefined) {
        changes.capacity = isBlank(input.capacity) ? null : parseInteger('capacity', input.capacity, 1, MAX_CAPACITY);
    }

    if (input.status !== undefined) changes.status = parseStatus(input.status);

    return changes;
}

// The tutor must be an active staff member whose user belongs to the classroom's school.
async function checkTutor(staffId: string, schoolId: string): Promise<void> {
    const staff = await Staff.findByPk(staffId, {
        attributes: ['id', 'active'],
        include: [{ model: User, as: 'user', attributes: ['schoolId'], required: true }],
    });
    if (!staff || !staff.active || staff.user?.schoolId !== schoolId) throw new HttpError(404, 'Tutor no encontrado en el colegio');
}

function handleWriteError(err: unknown): never {
    if (err instanceof HttpError) throw err;
    if (err instanceof UniqueConstraintError) throw new HttpError(409, 'Ya existe un aula con ese nombre en el colegio');
    if (err instanceof ForeignKeyConstraintError) throw new HttpError(400, 'Colegio o tutor no encontrado');
    throw new HttpError(500, (err as Error).message);
}

// ---- Mapping

function toListItem(classroom: ClassroomInstance): ClassroomListItem {
    return {
        id: classroom.id,
        name: classroom.name,
        level: classroom.level,
        grade: classroom.grade,
        section: classroom.section,
        staffId: classroom.staffId,
        tutor: classroom.staff?.user?.name ?? null,
        students: Number(classroom.get('students') ?? 0),
        capacity: classroom.capacity,
        status: classroom.status,
        statusLabel: CLASSROOM_STATUS_LABELS[classroom.status] ?? '',
    };
}

// Loads a classroom the session user can manage (APP_ADMIN: only its school; others answer 404).
// withDetail also loads the tutor and the number of students.
async function findManageable(id: string, currentUser?: UserInstance, withDetail = false): Promise<ClassroomInstance> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const options = withDetail ? { attributes: { include: [[STUDENT_COUNT, 'students']] }, include: [tutorInclude()] } : {};
    const classroom = isUuid(id) ? await Classroom.findByPk(id, options as object) : null;
    if (!classroom) throw new HttpError(404, 'Aula no encontrada');
    if (!isSuperadmin(currentUser) && classroom.schoolId !== currentUser.schoolId) throw new HttpError(404, 'Aula no encontrada');
    return classroom;
}

// ---- CRUD

export async function get(id: string, currentUser?: UserInstance): Promise<ClassroomDetail> {
    const classroom = await findManageable(id, currentUser, true);
    return {
        ...toListItem(classroom),
        schoolId: classroom.schoolId,
        createdAt: classroom.createdAt.toISOString(),
        updatedAt: classroom.updatedAt.toISOString(),
    };
}

// Required: name (unique within the school), level (enum or INICIAL/PRIMARIA/SECUNDARIA), grade and section.
// Optional: staffId (tutor: active staff of the same school), capacity (max students, 1..1000) and status
// (1 = ENABLED by default, 0 = DISABLED). APP_ADMIN uses its own school; a SUPERADMIN must send schoolId.
// The classroom is linked to the active schedules of its school with the same level.
export async function create(input: ClassroomInput, currentUser?: UserInstance): Promise<string> {
    const schoolId = resolveSchoolId(currentUser, input.schoolId);
    const data = parseInput(input, false);
    if (data.staffId) await checkTutor(data.staffId, schoolId);

    try {
        return await sequelize.transaction(async (transaction) => {
            const classroom = await Classroom.create({
                schoolId,
                name: data.name!,
                level: data.level!,
                grade: data.grade!,
                section: data.section!,
                staffId: data.staffId ?? null,
                capacity: data.capacity ?? null,
                status: data.status ?? ClassroomStatus.ENABLED,
            }, { transaction });
            await syncClassroomLinks(schoolId, transaction);
            return classroom.id;
        });
    } catch (err) {
        handleWriteError(err);
    }
}

// Partial update: only the fields sent change (staffId / capacity null or '' clear them). The school can't be
// changed. The capacity can't be lower than the students already linked to the classroom.
// Changing the level swaps its schedules for the active ones of the new level.
export async function update(id: string, input: ClassroomInput, currentUser?: UserInstance): Promise<void> {
    const classroom = await findManageable(id, currentUser);
    const changes = parseInput(input, true);

    if (changes.staffId) await checkTutor(changes.staffId, classroom.schoolId);
    if (changes.capacity) {
        const students = await Student.count({ where: { classroomId: classroom.id } });
        if (changes.capacity < students) {
            throw new HttpError(409, `La capacidad no puede ser menor que los ${students} alumno(s) del aula`);
        }
    }
    if (!Object.keys(changes).length) return;

    const levelChanged = changes.level !== undefined && changes.level !== classroom.level;
    try {
        await sequelize.transaction(async (transaction) => {
            await classroom.update(changes, { transaction });
            if (levelChanged) await syncClassroomLinks(classroom.schoolId, transaction);
        });
    } catch (err) {
        handleWriteError(err);
    }
}

// Hard delete. Refused while the classroom has students (they must be moved or unlinked first).
export async function remove(id: string, currentUser?: UserInstance): Promise<void> {
    const classroom = await findManageable(id, currentUser);
    const students = await Student.count({ where: { classroomId: classroom.id } });
    if (students) throw new HttpError(409, `No se puede eliminar: el aula tiene ${students} alumno(s)`);

    try {
        await classroom.destroy();
    } catch (err) {
        if (err instanceof ForeignKeyConstraintError) throw new HttpError(409, 'No se puede eliminar: el aula tiene alumnos');
        throw new HttpError(500, (err as Error).message);
    }
}

// ---- List

// Classrooms of the session user's school (SUPERADMIN: ?schoolId=), by name, paginated, with the tutor's name and
// the number of students. Optional filters: name (part of the name), tutor (part of the tutor's name), staffId
// (exact tutor), level (enum or INICIAL/PRIMARIA/SECUNDARIA) and status (0 | 1). Text filters ignore case.
export async function list(filters: ClassroomListFilters = {}, currentUser?: UserInstance): Promise<Paginated<ClassroomListItem>> {
    const schoolId = resolveSchoolId(currentUser, filters.schoolId);
    const { page, pageSize, limit, offset } = parsePagination(filters);

    const where: WhereOptions<ClassroomAttributes> = { schoolId };
    const name = String(filters.name ?? '').trim().replace(/\s+/g, ' ');
    if (name) where.name = { [Op.iLike]: containsPattern(name) };
    if (!isBlank(filters.level)) where.level = parseLevel(filters.level);
    if (!isBlank(filters.status)) where.status = parseStatus(filters.status);
    if (!isBlank(filters.staffId)) {
        const staffId = String(filters.staffId).trim();
        if (!isUuid(staffId)) throw new HttpError(400, 'staffId inválido');
        where.staffId = staffId;
    }
    const tutor = String(filters.tutor ?? '').trim().replace(/\s+/g, ' ');

    const { rows, count } = await Classroom.findAndCountAll({
        where,
        attributes: { include: [[STUDENT_COUNT, 'students']] },
        include: [tutorInclude(tutor || undefined)],
        order: [['name', 'ASC'], ['id', 'ASC']],
        distinct: true,
        limit,
        offset,
    });
    return toPaginated(rows.map(toListItem), count, page, pageSize);
}
