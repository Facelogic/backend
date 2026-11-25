import type { TimeEntrySource } from "../db/models/enums.ts";
import type { PaginationQuery } from "../utils/pagination.util.ts";

// Derived from the entry (no DB column), in this order:
// IN_PROGRESS = no clock-out yet (today) · INCOMPLETE = no clock-out and the day is over ·
// LATE = closed with lateness · ON_TIME = closed without lateness.
export const AttendanceStatus = ['ON_TIME', 'LATE', 'IN_PROGRESS', 'INCOMPLETE'] as const;
export type AttendanceStatus = (typeof AttendanceStatus)[number];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
    ON_TIME: 'Puntual',
    LATE: 'Tardanza',
    IN_PROGRESS: 'En curso',
    INCOMPLETE: 'Sin salida',
};

// Item of GET /api/attendance.
export interface AttendanceListItem {
    id: string;
    date: string; // dd/mm/yyyy (Lima)
    staffId: string;
    staff: string; // full name
    shiftId: string | null; // null only for entries recorded before the shift was linked
    shift: string; // name of the shift chosen when recording the attendance
    clockInAt: string; // ISO timestamp
    clockIn: string; // HH:mm (Lima)
    clockOutAt: string | null;
    clockOut: string | null; // HH:mm (Lima)
    isLate: boolean;
    lateMin: number;
    workedMin: number | null;
    overtimeMin: number;
    overtime: string; // "HH:mm"
    status: AttendanceStatus;
    statusLabel: string;
    remarks: string | null; // observation
    manualReason: string | null;
    source: TimeEntrySource;
    station: string | null;
}

// Body of POST /api/attendance.
export interface AttendanceInput {
    staffId?: unknown;
    shiftId?: unknown; // shift of this attendance (chosen when recording it)
    schoolId?: unknown; // SUPERADMIN only
    stationId?: unknown;
    clockInAt?: unknown; // ISO timestamp; defaults to now
    clockOutAt?: unknown; // ISO timestamp, optional
    source?: unknown;
    manualReason?: unknown;
    remarks?: unknown;
    confidence?: unknown;
}

// Response of POST /api/attendance.
export interface AttendanceCreated {
    id: string;
    lateMin: number;
    workedMin: number | null;
    overtimeMin: number;
    status: AttendanceStatus;
}

// Query string of GET /api/attendance; every filter is optional.
export interface AttendanceListFilters extends PaginationQuery {
    staffName?: unknown;
    staffId?: unknown;
    shiftId?: unknown;
    shift?: unknown; // part of the shift name
    schoolId?: unknown;
    dateFrom?: unknown; // yyyy-mm-dd (Lima), inclusive
    dateTo?: unknown; // yyyy-mm-dd (Lima), inclusive
    status?: unknown;
    late?: unknown;
}
