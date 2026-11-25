import type { PhotoType, PickupStatus, ValidationMethod } from "../db/models/enums.ts";
import type { PaginationQuery } from "../utils/pagination.util.ts";

// Item of GET /api/pickups.
export interface PickupListItem {
    id: string;
    code: string; // "RET-{yyyymmdd}-{######}"
    occurredAt: string; // ISO timestamp
    date: string; // dd/mm/yyyy (Lima)
    time: string; // HH:mm (Lima)
    studentId: string;
    student: string; // "Apellidos, Nombres"
    pickedUpBy: string; // who picked the student up
    guardianId: string | null;
    photoUrl: string | null; // temporary URL of the first photo; null without photo or once expired
    guardianNotified: boolean; // at least one delivered notification to a guardian
    status: PickupStatus;
    method: ValidationMethod;
    station: string | null;
    school: string;
}

// Body of POST /api/pickups (JSON or multipart/form-data when a `photo` file is sent).
export interface PickupInput {
    studentId?: unknown;
    schoolId?: unknown; // SUPERADMIN only
    stationId?: unknown;
    occurredAt?: unknown; // ISO timestamp; defaults to now
    method?: unknown;
    status?: unknown;
    guardianId?: unknown;
    pickedUpBy?: unknown;
    confidence?: unknown;
    manualReason?: unknown;
    noPhotoReason?: unknown;
    mediaId?: unknown; // photo already uploaded through /api/media
    photoType?: unknown;
    guardianNotified?: unknown;
}

// Photo file received in the multipart body.
export interface PickupPhotoFile {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
}

// Response of POST /api/pickups.
export interface PickupCreated {
    id: string;
    code: string;
    photoType: PhotoType | null;
    notifiedGuardians: number;
}

// Query string of GET /api/pickups; every filter is optional.
export interface PickupListFilters extends PaginationQuery {
    studentName?: unknown;
    studentId?: unknown;
    schoolId?: unknown;
    stationId?: unknown;
    dateFrom?: unknown; // yyyy-mm-dd (Lima), inclusive
    dateTo?: unknown; // yyyy-mm-dd (Lima), inclusive
    status?: unknown;
    method?: unknown;
    guardianNotified?: unknown;
}
