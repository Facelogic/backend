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
