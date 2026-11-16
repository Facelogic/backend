// Response of GET /api/dashboard/school-summary.
export interface SchoolSummary {
    totalSchools: number;
    photoNotifications: number;
    inactiveStations: number;
    stationsNeedingAttention: number;
}

// Response of GET /api/dashboard/user-summary (SUPERADMIN accounts excluded).
export interface UserSummary {
    total: number;
    active: number;
    pending: number;
    inactive: number;
}

// Response of GET /api/dashboard/station-summary.
export interface StationSummary {
    total: number;
    active: number;
    inactive: number;
}
