import type { ShiftType } from "../db/models/enums.ts";
import type { PaginationQuery } from "../utils/pagination.util.ts";

// Item of GET /api/shifts.
export interface ShiftItem {
    id: string;
    name: string;
    type: ShiftType;
    startTime: string | null;
    endTime: string | null;
    includesBreak: boolean;
    breakStart: string | null;
    breakEnd: string | null;
    breakDeductionMin: number;
    graceMin: number;
    countOvertime: boolean;
}

// Body of POST /api/shifts. The school comes from the session (SUPERADMIN must send schoolId).
export interface ShiftInput {
    name?: unknown;
    type?: unknown;
    startTime?: unknown;
    endTime?: unknown;
    includesBreak?: unknown;
    breakStart?: unknown;
    breakEnd?: unknown;
    breakDeductionMin?: unknown;
    graceMin?: unknown;
    countOvertime?: unknown;
    schoolId?: unknown;
}

// Query string of GET /api/shifts; every filter is optional (schoolId only for SUPERADMIN).
export interface ShiftListFilters extends PaginationQuery {
    name?: unknown;
    type?: unknown;
    schoolId?: unknown;
}
