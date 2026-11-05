import type { SchoolStatus } from "../constants/school-status.ts";
import type { PhotoServiceStatus, RegistrationStatus } from "../db/models/enums.ts";

export interface SchoolItem {
    id: string;
    slug: string;
    name: string;
    modularCode: string;
    taxId: string;
    address: string | null;
    region: string;
    province: string;
    district: string;
    principalName: string | null;
    registrationStatus: RegistrationStatus;
    photoService: PhotoServiceStatus;
    photoServiceSince: string | null;
    photoServiceCancelledAt: string | null;
    photoServiceNote: string | null;
    appPublishedAt: string | null;
    contractSignedAt: string | null;
    status: keyof typeof SchoolStatus;
    createdDate: string;
}

// Body of POST /api/schools (required fields checked by the service) and PUT /api/schools/:id
// (only the fields sent are changed; null/'' clears the optional ones).
export interface SchoolInput {
    slug?: unknown;
    name?: unknown;
    modularCode?: unknown;
    taxId?: unknown;
    address?: unknown;
    region?: unknown;
    province?: unknown;
    district?: unknown;
    principalName?: unknown;
    registrationStatus?: unknown;
    photoService?: unknown;
    photoServiceSince?: unknown;
    photoServiceCancelledAt?: unknown;
    photoServiceNote?: unknown;
    appPublishedAt?: unknown;
    contractSignedAt?: unknown;
    status?: unknown;
}

// Query string of GET /api/schools; every filter is optional.
export interface SchoolListFilters {
    name?: unknown;
    status?: unknown;
}
