import { ForeignKeyConstraintError, Op, UniqueConstraintError, type WhereOptions } from "sequelize";
import { FaceEnrollment, Guardian, School, Staff, User } from "../../db/models/index.ts";
import { isSuperadmin, resolveSchoolId } from "../../helper/school-scope.helper.ts";
import {
    EnrollmentPersonType,
    type EnrollmentDetail,
    type EnrollmentInput,
    type EnrollmentListFilters,
    type EnrollmentListItem,
} from "../../interfaces/enrollment.interface.ts";
import type { FaceEnrollmentAttributes, FaceEnrollmentInstance } from "../../interfaces/models/face-enrollment.interface.ts";
import type { UserInstance } from "../../interfaces/models/user.interface.ts";
import { limaDate } from "../../utils/date.util.ts";
import HttpError from "../../utils/http-error.ts";
import { parsePagination, toPaginated, type Paginated } from "../../utils/pagination.util.ts";
import { parseBoolean, parseInteger } from "../../utils/parse.util.ts";
import { containsPattern, isUuid } from "../../utils/text.util.ts";

type EnrollmentChanges = Partial<Pick<FaceEnrollmentAttributes, 'poses' | 'enrolledAt' | 'consentAt' | 'learnedTemplates' | 'lastTemplateAt'>>;

const MAX_POSES = 20;
const MAX_LEARNED_TEMPLATES = 1000;
const MAX_FUTURE_MS = 5 * 60 * 1000; // clock skew tolerated for timestamps sent by a station

const isBlank = (value: unknown) => value === undefined || value === null || String(value).trim() === '';

// ---- Parsing helpers

function parseUuid(field: string, raw: unknown): string | null {
    if (isBlank(raw)) return null;
    const value = String(raw).trim();
    if (!isUuid(value)) throw new HttpError(400, `${field} inválido`);
    return value;
}

function parseInstant(field: string, raw: unknown): Date {
    const date = new Date(String(raw ?? '').trim());
    if (Number.isNaN(date.getTime())) throw new HttpError(400, `${field} debe ser una fecha ISO 8601 válida`);
    if (date.getTime() > Date.now() + MAX_FUTURE_MS) throw new HttpError(400, `${field} no puede ser una fecha futura`);
    return date;
}

// Validates the editable fields present in the body (poses is required on create).
function parseChanges(input: EnrollmentInput, partial: boolean): EnrollmentChanges {
    const changes: EnrollmentChanges = {};

    if (!isBlank(input.poses) || !partial) changes.poses = parseInteger('poses', input.poses, 1, MAX_POSES);
    if (!isBlank(input.enrolledAt)) changes.enrolledAt = parseInstant('enrolledAt', input.enrolledAt);
    if (!isBlank(input.consentAt)) changes.consentAt = parseInstant('consentAt', input.consentAt);
    if (!isBlank(input.learnedTemplates)) {
        changes.learnedTemplates = parseInteger('learnedTemplates', input.learnedTemplates, 0, MAX_LEARNED_TEMPLATES);
    }
    if (input.lastTemplateAt !== undefined) {
        changes.lastTemplateAt = isBlank(input.lastTemplateAt) ? null : parseInstant('lastTemplateAt', input.lastTemplateAt);
    }
    return changes;
}

function handleWriteError(err: unknown): never {
    if (err instanceof HttpError) throw err;
    if (err instanceof UniqueConstraintError) throw new HttpError(409, 'La persona ya tiene un enrolamiento registrado');
    if (err instanceof ForeignKeyConstraintError) throw new HttpError(400, 'Colegio, personal o apoderado no encontrado');
    throw err;
}

// ---- Mapping

const includes = [
    { model: Staff, as: 'staff', attributes: ['id'], include: [{ model: User, as: 'user', attributes: ['name'] }] },
    { model: Guardian, as: 'guardian', attributes: ['id', 'name'] },
    { model: School, as: 'school', attributes: ['name'] },
];

function toListItem(enrollment: FaceEnrollmentInstance): EnrollmentListItem {
    const isStaff = enrollment.staffId !== null;
    return {
        id: enrollment.id,
        personType: isStaff ? 'STAFF' : 'GUARDIAN',
        personId: (enrollment.staffId ?? enrollment.guardianId)!,
        name: (isStaff ? enrollment.staff?.user?.name : enrollment.guardian?.name) ?? '',
        enrolledAt: enrollment.enrolledAt.toISOString(),
        enrolledDate: limaDate(enrollment.enrolledAt),
        poses: enrollment.poses,
        learnedTemplates: enrollment.learnedTemplates,
        lastTemplateAt: enrollment.lastTemplateAt?.toISOString() ?? null,
        school: enrollment.school?.name ?? '',
    };
}

function toDetail(enrollment: FaceEnrollmentInstance): EnrollmentDetail {
    return {
        ...toListItem(enrollment),
        schoolId: enrollment.schoolId,
        consentAt: enrollment.consentAt.toISOString(),
        updatedAt: enrollment.updatedAt.toISOString(),
    };
}

// Loads an enrollment the current user can manage (same school unless SUPERADMIN), or 404.
async function findManageable(id: string, currentUser?: UserInstance): Promise<FaceEnrollmentInstance> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const enrollment = isUuid(id) ? await FaceEnrollment.findByPk(id, { include: includes }) : null;
    if (!enrollment) throw new HttpError(404, 'Enrolamiento no encontrado');
    if (!isSuperadmin(currentUser) && enrollment.schoolId !== currentUser.schoolId) throw new HttpError(404, 'Enrolamiento no encontrado');
    return enrollment;
}

// ---- List

function buildWhere(filters: EnrollmentListFilters, currentUser: UserInstance): WhereOptions<FaceEnrollmentAttributes> {
    const conditions: WhereOptions<FaceEnrollmentAttributes>[] = [];

    if (isSuperadmin(currentUser)) {
        const schoolId = parseUuid('schoolId', filters.schoolId);
        if (schoolId) conditions.push({ schoolId });
    } else {
        if (!currentUser.schoolId) throw new HttpError(403, 'La cuenta no tiene un colegio asignado');
        conditions.push({ schoolId: currentUser.schoolId });
    }

    if (!isBlank(filters.personType)) {
        const type = String(filters.personType).trim().toUpperCase();
        if (type === 'STAFF') conditions.push({ staffId: { [Op.ne]: null } });
        else if (type === 'GUARDIAN') conditions.push({ guardianId: { [Op.ne]: null } });
        else throw new HttpError(400, `personType debe ser uno de ${EnrollmentPersonType.join(', ')}`);
    }

    const name = String(filters.name ?? '').trim().replace(/\s+/g, ' ');
    if (name) {
        const pattern = containsPattern(name);
        conditions.push({
            [Op.or]: [{ '$staff.user.name$': { [Op.iLike]: pattern } }, { '$guardian.name$': { [Op.iLike]: pattern } }],
        } as WhereOptions<FaceEnrollmentAttributes>);
    }

    return { [Op.and]: conditions };
}

// Newest enrollment first, paginated. A non-SUPERADMIN only sees its own school (its "schoolId" filter is ignored).
export async function list(filters: EnrollmentListFilters = {}, currentUser?: UserInstance): Promise<Paginated<EnrollmentListItem>> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const { page, pageSize, limit, offset } = parsePagination(filters);

    const { rows, count } = await FaceEnrollment.findAndCountAll({
        where: buildWhere(filters, currentUser),
        include: includes,
        order: [['enrolledAt', 'DESC'], ['id', 'ASC']],
        distinct: true,
        subQuery: false,
        limit,
        offset,
    });
    return toPaginated(rows.map(toListItem), count, page, pageSize);
}

export async function get(id: string, currentUser?: UserInstance): Promise<EnrollmentDetail> {
    return toDetail(await findManageable(id, currentUser));
}

// ---- Create / update / delete

// Required: staffId or guardianId (only one), poses, and consentAt or consent = true (consent given now).
// enrolledAt defaults to now; learnedTemplates starts at 0. The school is the person's (it must be the session
// user's school; a SUPERADMIN may send schoolId, which must match). One enrollment per person (409 otherwise).
export async function create(input: EnrollmentInput, currentUser?: UserInstance): Promise<string> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');

    const staffId = parseUuid('staffId', input.staffId);
    const guardianId = parseUuid('guardianId', input.guardianId);
    if (!staffId === !guardianId) throw new HttpError(400, 'Envía staffId o guardianId (solo uno)');

    let personSchoolId: string;
    if (staffId) {
        const staff = await Staff.findByPk(staffId, {
            attributes: ['id', 'active'],
            include: [{ model: User, as: 'user', attributes: ['schoolId'], required: true }],
        });
        if (!staff || !staff.active || !staff.user?.schoolId) throw new HttpError(404, 'Personal no encontrado');
        personSchoolId = staff.user.schoolId;
    } else {
        const guardian = await Guardian.findByPk(guardianId!, { attributes: ['id', 'schoolId'] });
        if (!guardian) throw new HttpError(404, 'Apoderado no encontrado');
        personSchoolId = guardian.schoolId;
    }
    const schoolId = isSuperadmin(currentUser)
        ? resolveSchoolId(currentUser, isBlank(input.schoolId) ? personSchoolId : input.schoolId)
        : resolveSchoolId(currentUser);
    if (personSchoolId !== schoolId) throw new HttpError(404, staffId ? 'Personal no encontrado' : 'Apoderado no encontrado');

    const data = parseChanges(input, false);
    const enrolledAt = data.enrolledAt ?? new Date();
    let consentAt = data.consentAt;
    if (!consentAt) {
        if (isBlank(input.consent) || !parseBoolean('consent', input.consent)) {
            throw new HttpError(400, 'Se requiere el consentimiento: envía consentAt o consent = true');
        }
        consentAt = new Date();
    }
    if (data.lastTemplateAt && data.lastTemplateAt < enrolledAt) throw new HttpError(400, 'lastTemplateAt no puede ser anterior a enrolledAt');

    try {
        const enrollment = await FaceEnrollment.create({
            schoolId,
            staffId,
            guardianId,
            poses: data.poses!,
            enrolledAt,
            consentAt,
            learnedTemplates: data.learnedTemplates ?? 0,
            lastTemplateAt: data.lastTemplateAt ?? null,
        });
        return enrollment.id;
    } catch (err) {
        handleWriteError(err);
    }
}

// Updates only the fields sent (poses, enrolledAt, consentAt, learnedTemplates, lastTemplateAt; null/'' clears
// lastTemplateAt). The person and the school can't be changed: delete and enroll again instead.
export async function update(id: string, input: EnrollmentInput, currentUser?: UserInstance): Promise<void> {
    const enrollment = await findManageable(id, currentUser);
    if (!isBlank(input.staffId) || !isBlank(input.guardianId)) {
        throw new HttpError(400, 'No se puede cambiar la persona del enrolamiento; elimínalo y vuelve a enrolar');
    }
    const changes = parseChanges(input, true);
    if (!Object.keys(changes).length) return;

    const enrolledAt = changes.enrolledAt ?? enrollment.enrolledAt;
    const lastTemplateAt = changes.lastTemplateAt !== undefined ? changes.lastTemplateAt : enrollment.lastTemplateAt;
    if (lastTemplateAt && lastTemplateAt < enrolledAt) throw new HttpError(400, 'lastTemplateAt no puede ser anterior a enrolledAt');

    try {
        await enrollment.update(changes);
    } catch (err) {
        handleWriteError(err);
    }
}

// Hard delete (the table has no status column): the person's face data is no longer enrolled.
export async function remove(id: string, currentUser?: UserInstance): Promise<void> {
    const enrollment = await findManageable(id, currentUser);
    await enrollment.destroy();
}
