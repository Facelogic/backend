import type { PaginationQuery } from "../utils/pagination.util.ts";

// Who the face enrollment belongs to: a staff member or a guardian (exactly one of them).
export const EnrollmentPersonType = ['STAFF', 'GUARDIAN'] as const;
export type EnrollmentPersonType = (typeof EnrollmentPersonType)[number];

// Item of GET /api/enrollments.
export interface EnrollmentListItem {
    id: string;
    personType: EnrollmentPersonType;
    personId: string;
    name: string; // full name of the person
    enrolledAt: string; // ISO timestamp
    enrolledDate: string; // dd/mm/yyyy (Lima)
    poses: number;
    learnedTemplates: number; // templates learned with use
    lastTemplateAt: string | null;
    school: string;
}

// GET /api/enrollments/:id.
export interface EnrollmentDetail extends EnrollmentListItem {
    schoolId: string;
    consentAt: string;
    updatedAt: string;
}

// Body of POST /api/enrollments (staffId or guardianId, poses and consent required) and
// PUT /api/enrollments/:id (only poses, enrolledAt, consentAt, learnedTemplates and lastTemplateAt can change).
export interface EnrollmentInput {
    staffId?: unknown;
    guardianId?: unknown;
    poses?: unknown;
    enrolledAt?: unknown; // ISO timestamp; defaults to now
    consentAt?: unknown; // ISO timestamp
    consent?: unknown; // true = consent given now (when consentAt isn't sent)
    learnedTemplates?: unknown;
    lastTemplateAt?: unknown;
    schoolId?: unknown; // SUPERADMIN only; defaults to the person's school
}

// Query string of GET /api/enrollments; every filter is optional.
export interface EnrollmentListFilters extends PaginationQuery {
    name?: unknown;
    personType?: unknown;
    schoolId?: unknown;
}
