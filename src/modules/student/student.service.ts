import crypto from "node:crypto";
import { col, fn, ForeignKeyConstraintError, Op, UniqueConstraintError, where as sqlWhere, type WhereOptions } from "sequelize";
import { DocumentType, School, Student } from "../../db/models/index.ts";
import { dateOrEmpty, LEVEL_LABELS, textOrEmpty, yesNo, type ExportRow } from "../../helper/export.helper.ts";
import type { StudentAttributes, StudentCreationAttributes, StudentInstance } from "../../interfaces/models/student.interface.ts";
import type { UserInstance } from "../../interfaces/models/user.interface.ts";
import type { StudentDetail, StudentInput, StudentListFilters, StudentListItem } from "../../interfaces/student.interface.ts";
import { formattedDate } from "../../utils/date.util.ts";
import HttpError from "../../utils/http-error.ts";
import { parsePagination, toPaginated, type Paginated } from "../../utils/pagination.util.ts";
import { containsPattern, isUuid } from "../../utils/text.util.ts";
import { parseBoolean } from "../../utils/parse.util.ts";
import { isSuperadmin, resolveSchoolId } from "../../helper/school-scope.helper.ts";
import { parseLevel } from "../../helper/level.helper.ts";

type StudentChanges = Partial<Omit<StudentAttributes, 'id' | 'createdAt' | 'updatedAt'>>;

// Text columns: max length = column size.
const TEXT_FIELDS = {
    firstName: { max: 80, required: true },
    lastName: { max: 80, required: true },
    grade: { max: 20, required: true },
    section: { max: 10, required: false },
} as const satisfies Record<string, { max: number; required: boolean }>;

// Validates the fields present in the body. With partial = false (create) the required ones must be there.
function parseInput(input: StudentInput, partial: boolean): StudentChanges {
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

    if (input.level !== undefined || !partial) changes.level = parseLevel(input.level);
    if (input.canLeaveAlone !== undefined) changes.canLeaveAlone = parseBoolean('canLeaveAlone', input.canLeaveAlone);
    else if (!partial) changes.canLeaveAlone = false;

    if (input.document !== undefined) changes.document = String(input.document ?? '').trim() || null;
    if (input.documentTypeId !== undefined) {
        const documentTypeId = String(input.documentTypeId ?? '').trim() || null;
        if (documentTypeId && !isUuid(documentTypeId)) throw new HttpError(400, 'documentTypeId inválido');
        changes.documentTypeId = documentTypeId;
    }

    return changes as StudentChanges;
}

// The document is optional, but when present it needs its type and must match the type's length (DNI 8, ...).
// Clearing the document also clears its type.
async function checkDocument(changes: StudentChanges, current?: StudentInstance): Promise<void> {
    if (changes.document === undefined && changes.documentTypeId === undefined) return;
    const document = changes.document !== undefined ? changes.document : current?.document ?? null;
    const documentTypeId = changes.documentTypeId !== undefined ? changes.documentTypeId : current?.documentTypeId ?? null;

    if (!document) {
        changes.document = null;
        changes.documentTypeId = null;
        return;
    }
    if (!documentTypeId) throw new HttpError(400, 'documentTypeId es obligatorio cuando se envía document');
    const type = await DocumentType.findByPk(documentTypeId);
    if (!type) throw new HttpError(400, 'Tipo de documento no encontrado');
    if (document.length !== type.size) throw new HttpError(400, `${type.name} debe tener ${type.size} caracteres`);
}

function handleWriteError(err: unknown): never {
    if (err instanceof HttpError) throw err;
    if (err instanceof UniqueConstraintError) throw new HttpError(409, 'El documento ya está registrado en el colegio');
    if (err instanceof ForeignKeyConstraintError) throw new HttpError(400, 'Colegio o tipo de documento no encontrado');
    throw new HttpError(500, (err as Error).message);
}

// Code printed on the student's badge / QR: "EST-" + 8 characters without look-alikes (0/O, 1/I).
const BADGE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateBadgeCode(): string {
    const bytes = crypto.randomBytes(8);
    return 'EST-' + Array.from(bytes, (b) => BADGE_ALPHABET[b % BADGE_ALPHABET.length]).join('');
}

const includes = [
    { model: School, as: 'school', attributes: ['name'] },
    { model: DocumentType, as: 'documentType', attributes: ['name'] },
];

// Loads an active student the current user can manage (same school unless SUPERADMIN), or 404.
async function findManageable(id: string, currentUser: UserInstance): Promise<StudentInstance> {
    const student = isUuid(id) ? await Student.findByPk(id, { include: includes }) : null;
    if (!student || !student.active) throw new HttpError(404, 'Estudiante no encontrado');
    if (!isSuperadmin(currentUser) && student.schoolId !== currentUser.schoolId) throw new HttpError(404, 'Estudiante no encontrado');
    return student;
}

// Filters shared by list and exportAll. Only active students. "name" matches part of the first name, last name
// or full name (case-insensitive); "level" accepts the enum value or its Spanish name.
// A non-SUPERADMIN only sees its own school (its "schoolId" filter is ignored).
function buildConditions(filters: StudentListFilters, currentUser: UserInstance): WhereOptions<StudentAttributes>[] {
    const conditions: WhereOptions<StudentAttributes>[] = [{ active: true }];

    if (isSuperadmin(currentUser)) {
        const schoolId = String(filters.schoolId ?? '').trim();
        if (schoolId) {
            if (!isUuid(schoolId)) throw new HttpError(400, 'schoolId inválido');
            conditions.push({ schoolId });
        }
    } else {
        if (!currentUser.schoolId) throw new HttpError(403, 'La cuenta no tiene un colegio asignado');
        conditions.push({ schoolId: currentUser.schoolId });
    }

    const name = String(filters.name ?? '').trim().replace(/\s+/g, ' ');
    if (name) {
        const pattern = containsPattern(name);
        conditions.push({
            [Op.or]: [
                { firstName: { [Op.iLike]: pattern } },
                { lastName: { [Op.iLike]: pattern } },
                sqlWhere(fn('concat', col('Student.firstName'), ' ', col('Student.lastName')), { [Op.iLike]: pattern }),
                sqlWhere(fn('concat', col('Student.lastName'), ' ', col('Student.firstName')), { [Op.iLike]: pattern }),
            ],
        } as WhereOptions<StudentAttributes>);
    }

    if (String(filters.level ?? '').trim()) conditions.push({ level: parseLevel(filters.level) });

    return conditions;
}

const ORDER: [string, string][] = [['lastName', 'ASC'], ['firstName', 'ASC'], ['id', 'ASC']];

function toListItem(student: StudentInstance): StudentListItem {
    return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        documentType: student.documentType?.name ?? null,
        document: student.document,
        level: student.level,
        grade: student.grade,
        section: student.section,
        canLeaveAlone: student.canLeaveAlone,
        school: student.school?.name ?? '',
    };
}

export async function list(filters: StudentListFilters = {}, currentUser?: UserInstance): Promise<Paginated<StudentListItem>> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const { page, pageSize, limit, offset } = parsePagination(filters);

    const { rows, count } = await Student.findAndCountAll({
        where: { [Op.and]: buildConditions(filters, currentUser) },
        include: includes,
        order: ORDER,
        distinct: true,
        limit,
        offset,
    });
    return toPaginated(rows.map(toListItem), count, page, pageSize);
}

// Every student matching the list filters (no pagination), as rows ready for an Excel sheet.
export async function exportAll(filters: StudentListFilters = {}, currentUser?: UserInstance): Promise<ExportRow[]> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');

    const students = await Student.findAll({
        where: { [Op.and]: buildConditions(filters, currentUser) },
        include: includes,
        order: ORDER,
    });
    return students.map((student) => ({
        'Apellidos': student.lastName,
        'Nombres': student.firstName,
        'Tipo de documento': student.documentType?.name ?? '',
        'Documento': textOrEmpty(student.document),
        'Nivel': LEVEL_LABELS[student.level] ?? student.level,
        'Grado': student.grade,
        'Sección': textOrEmpty(student.section),
        'Puede salir solo': yesNo(student.canLeaveAlone),
        'Código de carné': student.badgeCode,
        'Colegio': student.school?.name ?? '',
        'Fecha de registro': dateOrEmpty(student.createdAt),
    }));
}

export async function get(id: string, currentUser?: UserInstance): Promise<StudentDetail> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const student = await findManageable(id, currentUser);
    return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        documentTypeId: student.documentTypeId,
        documentType: student.documentType?.name ?? null,
        document: student.document,
        level: student.level,
        grade: student.grade,
        section: student.section,
        canLeaveAlone: student.canLeaveAlone,
        badgeCode: student.badgeCode,
        schoolId: student.schoolId,
        school: student.school?.name ?? '',
        createdDate: formattedDate(student.createdAt),
    };
}

// Required: firstName, lastName, level, grade (and schoolId for SUPERADMIN; other roles use their own school).
// Optional: documentTypeId + document, section, canLeaveAlone (false by default). The badge code is generated.
export async function create(input: StudentInput, currentUser?: UserInstance): Promise<string> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const data = parseInput(input, false);
    data.schoolId = resolveSchoolId(currentUser, input.schoolId);
    await checkDocument(data);

    // Retry on the (very unlikely) badge code collision.
    for (let attempt = 0; ; attempt++) {
        try {
            const student = await Student.create({ ...data, badgeCode: generateBadgeCode() } as StudentCreationAttributes);
            return student.id;
        } catch (err) {
            const badgeClash = err instanceof UniqueConstraintError && err.errors.some((e) => e.path === 'badgeCode');
            if (badgeClash && attempt < 3) continue;
            handleWriteError(err);
        }
    }
}

// Updates only the fields present in the body. The school can't be changed here.
export async function update(id: string, input: StudentInput, currentUser?: UserInstance): Promise<void> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const student = await findManageable(id, currentUser);
    const changes = parseInput({ ...input, schoolId: undefined }, true);
    await checkDocument(changes, student);
    if (!Object.keys(changes).length) return;

    try {
        await student.update(changes);
    } catch (err) {
        handleWriteError(err);
    }
}

// Soft delete: arrivals, pickups and notifications keep pointing at the student, so it is only marked inactive
// (it disappears from the list, export and detail).
export async function remove(id: string, currentUser?: UserInstance): Promise<void> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const student = await findManageable(id, currentUser);
    await student.update({ active: false });
}
