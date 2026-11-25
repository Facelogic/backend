import type { PaginationQuery } from "../utils/pagination.util.ts";
import type { StationStatus } from "../constants/station-status.ts";

// Item of GET /api/stations.
export interface StationListItem {
    id: string;
    name: string;
    code: string;
    school: string;
    version: string;
    lastCommunication: string;
    status: keyof typeof StationStatus;
}

// Item of GET /api/stations/simple.
export interface StationSimpleItem {
    id: string;
    name: string;
}

// GET /api/stations/:id.
export interface StationItem {
    id: string;
    name: string;
    code: string;
    schoolId: string;
    school: string;
    version: string | null;
    serialNumber: string | null;
    lastSyncAt: string | null;
    status: keyof typeof StationStatus;
    createdDate: string;
}

// Body of POST /api/stations (name, code and schoolId required; status is ignored, it starts ACTIVE)
// and PUT /api/stations/:id (only the fields sent are changed; null/'' clears the optional ones).
export interface StationInput {
    name?: unknown;
    code?: unknown;
    schoolId?: unknown;
    version?: unknown;
    serialNumber?: unknown;
    status?: unknown;
}

// Query string of GET /api/stations; every filter is optional.
export interface StationListFilters extends PaginationQuery {
    name?: unknown;
    schoolId?: unknown;
    status?: unknown;
}

// Body of PATCH /api/stations/:id/status.
export interface StationStatusInput {
    status?: unknown;
}
