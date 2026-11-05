export interface CreateUploadInput {
  mimeType: string;
  originalName?: string;
  ownerId?: string;
}

// Payload of the BullMQ "media-processing" jobs.
export interface MediaJobData {
  mediaId: string;
}
