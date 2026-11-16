import { Op } from "sequelize";
import { Role } from "../../db/models/index.ts";
import type { RoleItem } from "../../interfaces/role.interface.ts";

// Catalog for the role selector. SUPERADMIN is never assignable, so it is hidden.
export async function list(): Promise<RoleItem[]> {
    const roles = await Role.findAll({
        attributes: ['id', 'name', 'code'],
        where: { code: { [Op.ne]: 'SUPERADMIN' }, status: 1 },
        order: [['name', 'ASC']],
    });
    return roles.map(({ id, name, code }) => ({ id, name, code }));
}
