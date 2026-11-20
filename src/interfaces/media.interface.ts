import type { MediaStatus } from '../db/models/media.ts';
import type { PaginationQuery } from '../utils/pagination.util.ts';

export interface CreateUploadInput {
  mimeType: string;
  originalName?: string;
  ownerId: string;
  schoolId: string;
  stationId: string | null;
}

// School and (optional) station a new file is linked to; see mediaService.resolveTarget.
export interface MediaTarget {
  schoolId: string;
  stationId: string | null;
}

// File received by POST /api/media (multipart/form-data), uploaded to storage by the API.
export interface DirectUploadInput {
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
  ownerId: string;
  schoolId: string;
  stationId: string | null;
}

// Payload of the BullMQ "media-processing" jobs.
export interface MediaJobData {
  mediaId: string;
}

// Query string of GET /api/media; every filter is optional.
export interface MediaListFilters extends PaginationQuery {
  serialCode?: unknown;
  dateFrom?: unknown; // yyyy-mm-dd (Lima), inclusive
  dateTo?: unknown; // yyyy-mm-dd (Lima), inclusive
  schoolId?: unknown;
  stationId?: unknown;
  status?: unknown;
}

// Item of GET /api/media.
export interface MediaListItem {
  id: string;
  thumbnailUrl: string | null; // presigned URL of the thumbnail/poster (or the original); null while pending
  serialCode: string; // "RC-{yyyymmdd}-{######}", unique
  code: string; // school initials + save date (yyyymmdd), e.g. "CSJ20261119"
  savedAt: string; // ISO timestamp
  date: string; // dd/mm/yyyy
  time: string; // HH:mm
  school: string;
  station: string | null;
  status: MediaStatus;
}
