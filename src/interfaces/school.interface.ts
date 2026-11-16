import type { PaginationQuery } from "../utils/pagination.util.ts";
import type { SchoolStatus } from "../constants/school-status.ts";
import type { PhotoServiceStatus } from "../db/models/enums.ts";
import type { ScheduleItem } from "./schedule.interface.ts";

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
    phone: string | null;
    photoService: PhotoServiceStatus;
    photoServiceSince: string | null;
    photoServiceCancelledAt: string | null;
    photoServiceNote: string | null;
    appPublishedAt: string | null;
    contractSignedAt: string | null;
    status: keyof typeof SchoolStatus;
    createdDate: string;
    // Active stations of the school.
    stationCount: number;
    // All stations of the school, active or not.
    totalStationCount: number;
    // Only in GET /api/schools (placeholders for now: '-', 0 and '-').
    sendPhotos?: string;
    consentingAdults?: number;
    lastSync?: string;
    // Only in GET /api/schools/:id (active schedules, by level).
    schedules?: ScheduleItem[];
}

// Item of GET /api/schools/simple (selectors).
export interface SchoolOption {
    id: string;
    name: string;
}

// Body of POST /api/schools (required fields checked by the service) and PUT /api/schools/:id
// (only the fields sent are changed; null/'' clears the optional ones; `status` is ignored there,
// it's changed through PATCH /api/schools/:id/status).
export interface SchoolInput {
    slug?: unknown;
    name?: unknown;
    modularCode?: unknown;
    taxId?: unknown;
    address?: unknown;
    region?: unknown;
    province?: unknown;
    district?: unknown;
    schedules?: unknown;
    phone?: unknown;
    photoService?: unknown;
    photoServiceSince?: unknown;
    photoServiceCancelledAt?: unknown;
    photoServiceNote?: unknown;
    appPublishedAt?: unknown;
    contractSignedAt?: unknown;
    status?: unknown;
}

// Body of PATCH /api/schools/:id/status.
export interface SchoolStatusInput {
    status?: unknown;
}

// Query string of GET /api/schools; every filter is optional.
export interface SchoolListFilters extends PaginationQuery {
    name?: unknown;
    status?: unknown;
}
