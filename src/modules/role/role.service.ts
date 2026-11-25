import { Op } from "sequelize";
import { Role } from "../../db/models/index.ts";
import type { RoleItem } from "../../interfaces/role.interface.ts";

async function findActive(excludedCodes: string[]): Promise<RoleItem[]> {
    const roles = await Role.findAll({
        attributes: ['id', 'name', 'code'],
        where: { code: { [Op.notIn]: excludedCodes }, status: 1 },
        order: [['name', 'ASC']],
    });
    return roles.map(({ id, name, code }) => ({ id, name, code }));
}

// Catalog for the role selector. SUPERADMIN is never assignable, so it is hidden.
export function list(): Promise<RoleItem[]> {
    return findActive(['SUPERADMIN']);
}

// Roles below APP_ADMIN (school staff): everything except SUPERADMIN and APP_ADMIN.
export function listStaff(): Promise<RoleItem[]> {
    return findActive(['SUPERADMIN', 'APP_ADMIN']);
}
