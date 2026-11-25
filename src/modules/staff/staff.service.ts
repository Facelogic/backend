import { ForeignKeyConstraintError } from "sequelize";
import { sequelize, Shift, Staff, User } from "../../db/models/index.ts";
import { resolveSchoolId } from "../../helper/school-scope.helper.ts";
import type { UserInstance } from "../../interfaces/models/user.interface.ts";
import type { CreateStaffInput, StaffCreated, StaffSimpleItem } from "../../interfaces/staff.interface.ts";
import HttpError from "../../utils/http-error.ts";
import { isUuid } from "../../utils/text.util.ts";
import { insertUser, parseNewUser, sendInvitation } from "../user/user.service.ts";

// Active staff of one school, only id and full name (for selects/filters). APP_ADMIN / DOOR_STAFF always get
// their own school; a SUPERADMIN must send schoolId. The school and name come from the staff member's user.
export async function listSimple(schoolIdParam: unknown, currentUser?: UserInstance): Promise<StaffSimpleItem[]> {
    const schoolId = resolveSchoolId(currentUser, schoolIdParam);
    const items = await Staff.findAll({
        where: { active: true },
        attributes: ['id'],
        include: [{ model: User, as: 'user', attributes: ['name'], required: true, where: { schoolId } }],
        order: [[{ model: User, as: 'user' }, 'name', 'ASC'], ['id', 'ASC']],
    });
    return items.map((staff) => ({ id: staff.id, name: staff.user?.name ?? '' }));
}

// Creates a staff member: first its user (same fields and rules as POST /api/user, position required) and then the
// Staff row linked to it by userId, both in one transaction. Staff only stores department and shiftId (optional,
// must belong to the user's school); the school is the one of its user.
// APP_ADMIN always creates in its own school; a SUPERADMIN must send schoolId.
// After the commit the user gets the invitation email; if it can't be sent invitationSent is false and it can be
// resent with POST /api/user/:userId/invitation.
export async function create(input: CreateStaffInput, currentUser?: UserInstance): Promise<StaffCreated> {
    const schoolId = resolveSchoolId(currentUser, input.schoolId);
    const userData = await parseNewUser({ ...input, schoolId }, currentUser, { requirePosition: true });

    const department = String(input.department ?? '').trim();
    if (!department) throw new HttpError(400, 'El área (department) es obligatoria');
    if (department.length > 60) throw new HttpError(400, 'department debe tener como máximo 60 caracteres');

    const rawShiftId = String(input.shiftId ?? '').trim();
    let shiftId: string | null = null;
    if (rawShiftId) {
        if (!isUuid(rawShiftId)) throw new HttpError(400, 'shiftId inválido');
        const shift = await Shift.findOne({ where: { id: rawShiftId, schoolId }, attributes: ['id'] });
        if (!shift) throw new HttpError(404, 'Turno no encontrado');
        shiftId = shift.id;
    }

    const { user, staff } = await sequelize.transaction(async (transaction) => {
        const user = await insertUser(userData, transaction);
        try {
            const staff = await Staff.create({ userId: user.id, department, shiftId }, { transaction });
            return { user, staff };
        } catch (err) {
            if (err instanceof ForeignKeyConstraintError) throw new HttpError(400, 'Turno no encontrado');
            throw new HttpError(500, (err as Error).message);
        }
    });

    return { id: staff.id, userId: user.id, invitationSent: await sendInvitation(user) };
}
