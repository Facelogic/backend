import { Op } from "sequelize";
import { SchoolStatus } from "../../constants/school-status.ts";
import { StationStatus } from "../../constants/station-status.ts";
import { UserStatus } from "../../constants/user-status.ts";
import { Notification, School, Station, User } from "../../db/models/index.ts";
import type { SchoolSummary, StationSummary, UserSummary } from "../../interfaces/dashboard.interface.ts";

// Headline numbers of the provider console:
// - totalSchools: active schools (inactive ones are soft-deleted).
// - photoNotifications: notifications sent with a photo.
// - inactiveStations: stations with status INACTIVE.
// - stationsNeedingAttention: static 0 for now (criteria not defined yet).
export async function schoolSummary(): Promise<SchoolSummary> {
    const [totalSchools, photoNotifications, inactiveStations] = await Promise.all([
        School.count({ where: { status: SchoolStatus.ACTIVE } }),
        Notification.count({ where: { withPhoto: true } }),
        Station.count({ where: { status: StationStatus.INACTIVE } }),
    ]);

    // TODO: compute once "needs attention" is defined.
    const stationsNeedingAttention = 0;

    return { totalSchools, photoNotifications, inactiveStations, stationsNeedingAttention };
}

// User accounts by status, without the SUPERADMIN ones (same scope as GET /api/user):
// active = ACTIVE, pending = INVITED, inactive = DISABLED.
export async function userSummary(): Promise<UserSummary> {
    const notSuperadmin = { roleId: { [Op.ne]: process.env.SUPERADMIN_ROLE_ID } };
    const countWith = (status: UserStatus) => User.count({ where: { ...notSuperadmin, status } });

    const [total, active, pending, inactive] = await Promise.all([
        User.count({ where: notSuperadmin }),
        countWith(UserStatus.ACTIVE),
        countWith(UserStatus.INVITED),
        countWith(UserStatus.DISABLED),
    ]);

    return { total, active, pending, inactive };
}

// Stations by status.
export async function stationSummary(): Promise<StationSummary> {
    const [total, active, inactive] = await Promise.all([
        Station.count(),
        Station.count({ where: { status: StationStatus.ACTIVE } }),
        Station.count({ where: { status: StationStatus.INACTIVE } }),
    ]);

    return { total, active, inactive };
}
