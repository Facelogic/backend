import type { Level } from "../db/models/enums.ts";
import type { PaginationQuery } from "../utils/pagination.util.ts";

// Item of GET /api/students.
export interface StudentListItem {
    id: string;
    firstName: string;
    lastName: string;
    documentType: string | null;
    document: string | null;
    level: Level;
    grade: string;
    section: string | null;
    canLeaveAlone: boolean;
    school: string;
}

// GET /api/students/:id, with the ids needed to fill the edit form.
export interface StudentDetail {
    id: string;
    firstName: string;
    lastName: string;
    documentTypeId: string | null;
    documentType: string | null;
    document: string | null;
    level: Level;
    grade: string;
    section: string | null;
    canLeaveAlone: boolean;
    badgeCode: string;
    schoolId: string;
    school: string;
    createdDate: string;
}

// Body of POST /api/students (firstName, lastName, level and grade required; schoolId required for SUPERADMIN)
// and PUT /api/students/:id (only the fields sent are changed; null/'' clears the optional ones).
export interface StudentInput {
    firstName?: unknown;
    lastName?: unknown;
    documentTypeId?: unknown;
    document?: unknown;
    level?: unknown;
    grade?: unknown;
    section?: unknown;
    canLeaveAlone?: unknown;
    schoolId?: unknown;
}

// Query string of GET /api/students and GET /api/students/export; every filter is optional.
export interface StudentListFilters extends PaginationQuery {
    name?: unknown;
    level?: unknown;
    schoolId?: unknown;
}
