import { parsePagination, toPaginated, type Paginated } from "../../utils/pagination.util.ts";
import { ForeignKeyConstraintError, Op, UniqueConstraintError, type WhereOptions } from "sequelize";
import { UserStatus } from "../../constants/user-status.ts";
import { DocumentType, Role, School, sequelize, Session, User } from "../../db/models/index.ts";
import { isValidEmail, normalizeEmail } from "../../helper/auth.helper.ts";
import { parsePhone } from "../../helper/phone.helper.ts";
import { dateOrEmpty, textOrEmpty, USER_STATUS_LABELS, type ExportRow } from "../../helper/export.helper.ts";
import { toUserStatusKey } from "../../helper/user.helper.ts";
import type { UserAttributes, UserInstance } from "../../interfaces/models/user.interface.ts";
import type { CreateUserInput, UpdateUserInput, UserItem, UserDetail, UserListFilters, UserStatusInput } from "../../interfaces/user.interface.ts";
import { formattedDate } from "../../utils/date.util.ts";
import HttpError from "../../utils/http-error.ts";
import { containsPattern, isUuid, optionalText } from "../../utils/text.util.ts";


function toItem(user: UserInstance): UserItem {
    const { id, name, email, position, role, school, status, phone } = user;
    return {
        id,
        name,
        email,
        phone,
        position,
        role: role?.code ?? '',
        school: school?.name || null,
        status: toUserStatusKey(status),
    };
}

// Optional job title ("User"."position" is VARCHAR(80)); null or '' clears it.
function parsePosition(value: unknown): string | null {
    const position = optionalText(value);
    if (position && position.length > 80) throw new HttpError(400, 'position debe tener como máximo 80 caracteres');
    return position;
}

// The document number must match the length of its type (DNI 8, Pasaporte 12, ...).
async function checkDocumentLength(document: string, documentTypeId: string): Promise<void> {
    const type = await DocumentType.findByPk(documentTypeId);
    if (!type) throw new HttpError(400, 'Tipo de documento no encontrado');
    if (document.length !== type.size) throw new HttpError(400, `${type.name} debe tener ${type.size} caracteres`);
}

// Required: name (full name), email, documentTypeId, document, roleId and schoolId. Optional: phone and position.
// A non-SUPERADMIN can only create users for its own school.
export async function create(input: CreateUserInput, currentUser?: UserInstance): Promise<string> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');

    const name = String(input.name ?? '').trim();
    if (!name) throw new HttpError(400, 'El nombre es obligatorio');
    if (name.length > 120) throw new HttpError(400, 'name debe tener como máximo 120 caracteres');

    const email = normalizeEmail(input.email);
    if (!isValidEmail(email)) throw new HttpError(400, 'Correo electrónico inválido');

    const roleId = String(input.roleId ?? '').trim();
    if (!UUID_RE.test(roleId)) throw new HttpError(400, 'roleId inválido');
    if (roleId === process.env.SUPERADMIN_ROLE_ID) throw new HttpError(403, 'No se puede asignar el rol de superadministrador');

    const schoolId = String(input.schoolId ?? '').trim();
    if (!UUID_RE.test(schoolId)) throw new HttpError(400, 'schoolId inválido');
    if (currentUser.role?.code !== 'SUPERADMIN' && schoolId !== currentUser.schoolId) {
        throw new HttpError(403, 'Solo puedes crear usuarios para tu propio colegio');
    }

    const documentTypeId = String(input.documentTypeId ?? '').trim();
    if (!UUID_RE.test(documentTypeId)) throw new HttpError(400, 'documentTypeId inválido');
    const document = String(input.document ?? '').trim();
    if (!document) throw new HttpError(400, 'El documento es obligatorio');
    await checkDocumentLength(document, documentTypeId);

    const phone = parsePhone(input.phone);
    const position = parsePosition(input.position);

    try {
        const user = await User.create({ name, email, documentTypeId, document, phone, position, roleId, schoolId });
        return user.id;
    } catch (err) {
        if (err instanceof UniqueConstraintError) {
            const field = err.errors[0]?.path;
            throw new HttpError(409, field === 'document' ? 'El documento ya está registrado' : 'El correo electrónico ya está registrado');
        }
        if (err instanceof ForeignKeyConstraintError) throw new HttpError(400, 'Rol, colegio o tipo de documento no encontrado');
        throw new HttpError(500, (err as Error).message);
    }
}

// Optional filters of GET /api/user: ?name=&roleId=&schoolId=&status=
// "name" matches part of the name (case-insensitive); the rest must match exactly.
// A SUPERADMIN sees every school; any other role only sees the users of its own school
// (its "schoolId" filter is ignored).
// Shared by list and exportAll.
function buildConditions(filters: UserListFilters, currentUser: UserInstance): WhereOptions<UserAttributes>[] {
    const where: WhereOptions<UserAttributes> = { roleId: { [Op.not]: process.env.SUPERADMIN_ROLE_ID } };
    const conditions: WhereOptions<UserAttributes>[] = [where];

    if (currentUser.role?.code !== 'SUPERADMIN') {
        if (!currentUser.schoolId) throw new HttpError(403, 'La cuenta no tiene un colegio asignado');
        conditions.push({ schoolId: currentUser.schoolId });
    }

    const name = String(filters.name ?? '').trim();
    if (name) {
        conditions.push({ name: { [Op.iLike]: containsPattern(name) } });
    }

    const roleId = String(filters.roleId ?? '').trim();
    if (roleId) {
        if (!isUuid(roleId)) throw new HttpError(400, 'roleId inválido');
        conditions.push({ roleId });
    }

    const schoolId = String(filters.schoolId ?? '').trim();
    if (schoolId && currentUser.role?.code === 'SUPERADMIN') {
        if (!isUuid(schoolId)) throw new HttpError(400, 'schoolId inválido');
        conditions.push({ schoolId });
    }

    const status = String(filters.status ?? '').trim();
    if (status) {
        const value = Number(status);
        if (!STATUS_VALUES.includes(value)) throw new HttpError(400, `status debe ser uno de ${STATUS_VALUES.join(', ')}`);
        conditions.push({ status: value as UserStatus });
    }

    return conditions;
}

export async function list(filters: UserListFilters = {}, currentUser?: UserInstance): Promise<Paginated<UserItem>> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const { page, pageSize, limit, offset } = parsePagination(filters);
    const conditions = buildConditions(filters, currentUser);

    try {
        const { rows, count } = await User.findAndCountAll({
            where: { [Op.and]: conditions },
            include: [
                { model: Role, as: 'role', attributes: ['code'], required: true, where: { status: 1 } },
                { model: School, as: 'school', attributes: ['name'], required: true, where: { status: 1 } },
            ],
            order: [['createdAt', 'ASC'], ['id', 'ASC']],
            distinct: true,
            limit,
            offset,
        });
        return toPaginated(rows.map(toItem), count, page, pageSize);
    } catch (err) {
        throw new HttpError(500, (err as Error).message);
    }
}

// Every user matching the list filters (no pagination), as rows ready for an Excel sheet.
// Same rules as list: never the superadmin, and a non-SUPERADMIN only gets its own school.
export async function exportAll(filters: UserListFilters = {}, currentUser?: UserInstance): Promise<ExportRow[]> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const conditions = buildConditions(filters, currentUser);

    const users = await User.findAll({
        where: { [Op.and]: conditions },
        include: [
            {
                model: Role,
                as: 'role',
                attributes: ['name', 'code'],
                required: true,
                where: { status: 1, code: { [Op.ne]: 'SUPERADMIN' } },
            },
            { model: School, as: 'school', attributes: ['name'], required: true, where: { status: 1 } },
            { model: DocumentType, as: 'documentType', attributes: ['name'] },
        ],
        order: [['name', 'ASC'], ['id', 'ASC']],
    });
    return users.map((user) => ({
        'Nombre': user.name,
        'Correo electrónico': user.email,
        'Tipo de documento': user.documentType?.name ?? '',
        'Documento': textOrEmpty(user.document),
        'Teléfono': textOrEmpty(user.phone),
        'Cargo': textOrEmpty(user.position),
        'Rol': user.role?.name ?? '',
        'Colegio': user.school?.name ?? '',
        'Estado': USER_STATUS_LABELS[user.status] ?? '',
        'Último acceso': dateOrEmpty(user.lastLoginAt),
        'Fecha de registro': dateOrEmpty(user.createdAt),
    }));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_VALUES = Object.values(UserStatus) as number[];
const CHANGEABLE_STATUS_VALUES: number[] = [UserStatus.DISABLED, UserStatus.ACTIVE];

// Loads a user that can be managed through this module (the superadmin can't be edited or deleted here).
async function findManageable(id: string) {
    const user = UUID_RE.test(id) ? await User.findByPk(id) : null;
    if (!user || user.roleId === process.env.SUPERADMIN_ROLE_ID) throw new HttpError(404, 'Usuario no encontrado');
    return user;
}

// Detail of one user (GET /api/user/:id), with the ids needed to fill the edit form.
// A non-SUPERADMIN can only see users of its own school.
export async function get(id: string, currentUser?: UserInstance): Promise<UserDetail> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');
    const user = UUID_RE.test(id)
        ? await User.findByPk(id, {
            include: [
                { model: Role, as: 'role', attributes: ['code'] },
                { model: School, as: 'school', attributes: ['name'] },
            ],
        })
        : null;
    if (!user || user.roleId === process.env.SUPERADMIN_ROLE_ID) throw new HttpError(404, 'Usuario no encontrado');
    if (currentUser.role?.code !== 'SUPERADMIN' && user.schoolId !== currentUser.schoolId) {
        throw new HttpError(404, 'Usuario no encontrado');
    }

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        position: user.position,
        documentTypeId: user.documentTypeId,
        document: user.document,
        roleId: user.roleId,
        role: user.role?.code ?? '',
        schoolId: user.schoolId,
        school: user.school?.name ?? null,
        status: toUserStatusKey(user.status),
        lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
        createdDate: formattedDate(user.createdAt),
    };
}

// Updates only the fields present in the body; null or '' clears the optional ones.
export async function update(id: string, input: UpdateUserInput): Promise<void> {
    const user = await findManageable(id);
    const changes: Partial<UserAttributes> = {};

    if (input.email !== undefined) {
        const email = normalizeEmail(input.email);
        if (!isValidEmail(email)) throw new HttpError(400, 'Correo electrónico inválido');
        changes.email = email;
    }
    if (input.name !== undefined) {
        const name = String(input.name ?? '').trim();
        if (!name) throw new HttpError(400, 'El nombre es obligatorio');
        changes.name = name;
    }
    if (input.roleId !== undefined) {
        const roleId = String(input.roleId ?? '').trim();
        if (!UUID_RE.test(roleId)) throw new HttpError(400, 'roleId inválido');
        if (roleId === process.env.SUPERADMIN_ROLE_ID) throw new HttpError(403, 'No se puede asignar el rol de superadministrador');
        changes.roleId = roleId;
    }
    if (input.schoolId !== undefined) changes.schoolId = optionalText(input.schoolId);
    if (input.document !== undefined) changes.document = optionalText(input.document);
    if (input.phone !== undefined) changes.phone = parsePhone(input.phone);
    if (input.position !== undefined) changes.position = parsePosition(input.position);
    if (input.documentTypeId !== undefined) changes.documentTypeId = optionalText(input.documentTypeId);
    if (input.status !== undefined) {
        const status = Number(input.status);
        if (!STATUS_VALUES.includes(status)) throw new HttpError(400, `status debe ser uno de ${STATUS_VALUES.join(', ')}`);
        changes.status = status as UserStatus;
    }

    for (const key of ['schoolId', 'documentTypeId'] as const) {
        const value = changes[key];
        if (value && !UUID_RE.test(value)) throw new HttpError(400, `${key} inválido`);
    }

    const document = changes.document !== undefined ? changes.document : user.document;
    const documentTypeId = changes.documentTypeId !== undefined ? changes.documentTypeId : user.documentTypeId;
    if (document && documentTypeId && (changes.document !== undefined || changes.documentTypeId !== undefined)) {
        await checkDocumentLength(document, documentTypeId);
    }

    if (!Object.keys(changes).length) return;

    try {
        await user.update(changes);
    } catch (err) {
        if (err instanceof UniqueConstraintError) {
            const field = err.errors[0]?.path;
            throw new HttpError(409, field === 'document' ? 'El documento ya está registrado' : 'El correo electrónico ya está registrado');
        }
        if (err instanceof ForeignKeyConstraintError) throw new HttpError(400, 'Rol, colegio o tipo de documento no encontrado');
        throw new HttpError(500, (err as Error).message);
    }
}

// Changes only the status: 0 = DISABLED (inactive) or 1 = ACTIVE. INVITED (2) is not accepted here.
// Disabling closes every session of the user. A non-SUPERADMIN can only change users of its own school.
export async function changeStatus(id: string, input: UserStatusInput, currentUser?: UserInstance): Promise<void> {
    if (!currentUser) throw new HttpError(401, 'No autenticado');

    const raw = input.status;
    const status = raw === undefined || raw === null || String(raw).trim() === '' ? NaN : Number(raw);
    if (!CHANGEABLE_STATUS_VALUES.includes(status)) {
        throw new HttpError(400, `status debe ser uno de ${CHANGEABLE_STATUS_VALUES.join(', ')}`);
    }
    if (id === currentUser.id) throw new HttpError(400, 'No puedes cambiar el estado de tu propia cuenta');

    const user = await findManageable(id);
    if (currentUser.role?.code !== 'SUPERADMIN' && user.schoolId !== currentUser.schoolId) {
        throw new HttpError(404, 'Usuario no encontrado');
    }

    await sequelize.transaction(async (transaction) => {
        if (user.status !== status) await user.update({ status: status as UserStatus }, { transaction });
        if (status === UserStatus.DISABLED) await Session.destroy({ where: { userId: user.id }, transaction });
    });
}

// Soft delete: the account is disabled (it can't log in anymore) and its sessions are closed.
// The row is kept because other tables reference it (time entries, pickups, audit log, ...).
export async function remove(id: string, currentUserId: string | undefined): Promise<void> {
    if (id === currentUserId) throw new HttpError(400, 'No puedes eliminar tu propia cuenta');
    const user = await findManageable(id);

    await sequelize.transaction(async (transaction) => {
        await user.update({ status: UserStatus.DISABLED }, { transaction });
        await Session.destroy({ where: { userId: user.id }, transaction });
    });
}
