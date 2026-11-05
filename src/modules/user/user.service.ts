import { ForeignKeyConstraintError, Op, UniqueConstraintError, type WhereOptions } from "sequelize";
import { UserStatus } from "../../constants/user-status.ts";
import { DocumentType, Role, School, sequelize, Session, User } from "../../db/models/index.ts";
import { isValidEmail, normalizeEmail } from "../../helper/auth.helper.ts";
import { toUserStatusKey } from "../../helper/user.helper.ts";
import type { RegisterInput } from "../../interfaces/auth.interface.ts";
import type { UserAttributes, UserInstance } from "../../interfaces/models/user.interface.ts";
import type { UpdateUserInput, UserItem, UserListFilters } from "../../interfaces/user.interface.ts";
import { formattedDate } from "../../utils/date.util.ts";
import HttpError from "../../utils/http-error.ts";
import { containsPattern, isUuid, optionalText } from "../../utils/text.util.ts";

// Optional phone ("User"."phone" is VARCHAR(15)): digits with an optional leading "+", e.g. "+51987654321".
// Spaces, hyphens and parentheses are stripped before validating; null or '' clears it.
const PHONE_RE = /^\+?\d{6,14}$/;
function parsePhone(value: unknown): string | null {
    const phone = optionalText(value)?.replace(/[\s()-]/g, '') || null;
    if (phone && (phone.length > 15 || !PHONE_RE.test(phone))) {
        throw new HttpError(400, 'Invalid phone: use up to 15 characters, digits with an optional leading +');
    }
    return phone;
}

function toItem(user: InstanceType<typeof User>): UserItem {
    const { id, document, name, email, phone, role, documentType, school, status, createdAt } = user;
    return {
        id,
        document,
        email,
        name,
        phone,
        documentType: documentType?.name || null,
        role: role.code,
        school: school?.name || null,
        status: toUserStatusKey(status),
        createdDate: formattedDate(createdAt)
    };
}


export async function create(input: RegisterInput): Promise<string> {
    if (input.email !== undefined) {
        const email = normalizeEmail(input.email);
        if (!isValidEmail(email)) throw new HttpError(400, 'Invalid email');
    }
    if (input.name !== undefined) {
        const name = String(input.name ?? '').trim();
        if (!name) throw new HttpError(400, 'Name is required');
    }
    if (input.roleId !== undefined) {
        const roleId = String(input.roleId ?? '').trim();
        if (!UUID_RE.test(roleId)) throw new HttpError(400, 'Invalid roleId');
        if (roleId === process.env.SUPERADMIN_ROLE_ID) throw new HttpError(403, 'Cannot assign the superadmin role');
    }
    const phone = parsePhone(input.phone);

    try {
        const email = normalizeEmail(input.email);
        const name = String(input.name ?? '').trim();
        const roleId = String(input.roleId ?? '').trim();

        const schoolId = String(input.schoolId ?? '').trim() || null;
        const document = String(input.document ?? '').trim() || null;
        const documentTypeId = String(input.documentTypeId ?? '').trim() || null;

        const userCreated = await User.create({
            document,
            documentTypeId,
            phone,
            email,
            name,
            roleId,
            schoolId
        });

        return userCreated.id;
    } catch (err) {
        if (err instanceof UniqueConstraintError) {
            const field = err.errors[0]?.path;
            throw new HttpError(409, field === 'document' ? 'Document already registered' : 'Email already registered');
        }
        throw new HttpError(500, (err as Error).message);
    }
}

// Optional filters of GET /api/user: ?name=&roleId=&schoolId=&status=
// "name" matches part of the name (case-insensitive); the rest must match exactly.
// A SUPERADMIN sees every school; any other role only sees the users of its own school
// (its "schoolId" filter is ignored).
export async function list(filters: UserListFilters = {}, currentUser?: UserInstance): Promise<UserItem[]> {
    if (!currentUser) throw new HttpError(401, 'Not authenticated');
    const where: WhereOptions<UserAttributes> = { roleId: { [Op.not]: process.env.SUPERADMIN_ROLE_ID } };
    const conditions: WhereOptions<UserAttributes>[] = [where];

    if (currentUser.role?.code !== 'SUPERADMIN') {
        if (!currentUser.schoolId) throw new HttpError(403, 'The account has no school assigned');
        conditions.push({ schoolId: currentUser.schoolId });
    }

    const name = String(filters.name ?? '').trim();
    if (name) {
        conditions.push({ name: { [Op.iLike]: containsPattern(name) } });
    }

    const roleId = String(filters.roleId ?? '').trim();
    if (roleId) {
        if (!isUuid(roleId)) throw new HttpError(400, 'Invalid roleId');
        conditions.push({ roleId });
    }

    const schoolId = String(filters.schoolId ?? '').trim();
    if (schoolId && currentUser.role?.code === 'SUPERADMIN') {
        if (!isUuid(schoolId)) throw new HttpError(400, 'Invalid schoolId');
        conditions.push({ schoolId });
    }

    const status = String(filters.status ?? '').trim();
    if (status) {
        const value = Number(status);
        if (!STATUS_VALUES.includes(value)) throw new HttpError(400, `status must be one of ${STATUS_VALUES.join(', ')}`);
        conditions.push({ status: value as UserStatus });
    }

    try {
        const users = await User.findAll({
            where: { [Op.and]: conditions },
            include: [
                { model: Role, as: 'role', required: true, where: { status: 1 } },
                { model: School, as: 'school', required: true, where: { status: 1 } },
                { model: DocumentType, as: 'documentType', required: false },
            ],
            order: [['createdAt', 'ASC']],
        });
        return users.map(toItem);
    } catch (err) {
        throw new HttpError(500, (err as Error).message);
    }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS_VALUES = Object.values(UserStatus) as number[];

// Loads a user that can be managed through this module (the superadmin can't be edited or deleted here).
async function findManageable(id: string) {
    const user = UUID_RE.test(id) ? await User.findByPk(id) : null;
    if (!user || user.roleId === process.env.SUPERADMIN_ROLE_ID) throw new HttpError(404, 'User not found');
    return user;
}

// Updates only the fields present in the body; null or '' clears the optional ones.
export async function update(id: string, input: UpdateUserInput): Promise<void> {
    const user = await findManageable(id);
    const changes: Partial<UserAttributes> = {};

    if (input.email !== undefined) {
        const email = normalizeEmail(input.email);
        if (!isValidEmail(email)) throw new HttpError(400, 'Invalid email');
        changes.email = email;
    }
    if (input.name !== undefined) {
        const name = String(input.name ?? '').trim();
        if (!name) throw new HttpError(400, 'Name is required');
        changes.name = name;
    }
    if (input.roleId !== undefined) {
        const roleId = String(input.roleId ?? '').trim();
        if (!UUID_RE.test(roleId)) throw new HttpError(400, 'Invalid roleId');
        if (roleId === process.env.SUPERADMIN_ROLE_ID) throw new HttpError(403, 'Cannot assign the superadmin role');
        changes.roleId = roleId;
    }
    if (input.schoolId !== undefined) changes.schoolId = optionalText(input.schoolId);
    if (input.document !== undefined) changes.document = optionalText(input.document);
    if (input.phone !== undefined) changes.phone = parsePhone(input.phone);
    if (input.documentTypeId !== undefined) changes.documentTypeId = optionalText(input.documentTypeId);
    if (input.status !== undefined) {
        const status = Number(input.status);
        if (!STATUS_VALUES.includes(status)) throw new HttpError(400, `Status must be one of ${STATUS_VALUES.join(', ')}`);
        changes.status = status as UserStatus;
    }

    for (const key of ['schoolId', 'documentTypeId'] as const) {
        const value = changes[key];
        if (value && !UUID_RE.test(value)) throw new HttpError(400, `Invalid ${key}`);
    }

    // The document number must match the length of its type (DNI 8, Pasaporte 12, ...).
    const document = changes.document !== undefined ? changes.document : user.document;
    const documentTypeId = changes.documentTypeId !== undefined ? changes.documentTypeId : user.documentTypeId;
    if (document && documentTypeId && (changes.document !== undefined || changes.documentTypeId !== undefined)) {
        const type = await DocumentType.findByPk(documentTypeId);
        if (!type) throw new HttpError(400, 'Document type not found');
        if (document.length !== type.size) throw new HttpError(400, `${type.name} must have ${type.size} characters`);
    }

    if (!Object.keys(changes).length) return;

    try {
        await user.update(changes);
    } catch (err) {
        if (err instanceof UniqueConstraintError) {
            const field = err.errors[0]?.path;
            throw new HttpError(409, field === 'document' ? 'Document already registered' : 'Email already registered');
        }
        if (err instanceof ForeignKeyConstraintError) throw new HttpError(400, 'Role, school or document type not found');
        throw new HttpError(500, (err as Error).message);
    }
}

// Soft delete: the account is disabled (it can't log in anymore) and its sessions are closed.
// The row is kept because other tables reference it (time entries, pickups, audit log, ...).
export async function remove(id: string, currentUserId: string | undefined): Promise<void> {
    if (id === currentUserId) throw new HttpError(400, 'You cannot delete your own account');
    const user = await findManageable(id);

    await sequelize.transaction(async (transaction) => {
        await user.update({ status: UserStatus.DISABLED }, { transaction });
        await Session.destroy({ where: { userId: user.id }, transaction });
    });
}
