import type { ClassroomStatus } from "../constants/classroom-status.ts";
import type { Level } from "../db/models/enums.ts";
import type { PaginationQuery } from "../utils/pagination.util.ts";

export const CLASSROOM_STATUS_LABELS: Record<number, string> = {
    0: 'Inhabilitado',
    1: 'Habilitado',
};

// Item of GET /api/classrooms.
export interface ClassroomListItem {
    id: string;
    name: string;
    level: Level;
    grade: string;
    section: string;
    staffId: string | null;
    tutor: string | null; // full name of the tutor (from its user)
    students: number; // students linked to the classroom
    capacity: number | null;
    status: ClassroomStatus;
    statusLabel: string;
}

// GET /api/classrooms/:id (fills the edit form).
export interface ClassroomDetail extends ClassroomListItem {
    schoolId: string;
    createdAt: string;
    updatedAt: string;
}

// Body of POST /api/classrooms and PUT /api/classrooms/:id.
// POST requires name, level, grade and section (and schoolId for SUPERADMIN); PUT only changes the fields sent.
// staffId and capacity are optional (null or '' clears them); status is 0 (DISABLED) or 1 (ENABLED, default).
export interface ClassroomInput {
    name?: unknown;
    level?: unknown;
    grade?: unknown;
    section?: unknown;
    staffId?: unknown;
    capacity?: unknown;
    status?: unknown;
    schoolId?: unknown;
}

// Query string of GET /api/classrooms; every filter is optional (schoolId only for SUPERADMIN).
export interface ClassroomListFilters extends PaginationQuery {
    name?: unknown;
    tutor?: unknown;
    staffId?: unknown;
    level?: unknown;
    status?: unknown;
    schoolId?: unknown;
}
