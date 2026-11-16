// Common contract of the storage drivers (S3-compatible and Vercel Blob). Keys are the object pathnames.
export interface StorageDriver {
  // Value stored in "Media"."bucket": the S3 bucket or the Blob store id.
  bucket: string;
  // URL the client PUTs the file to (with the same Content-Type).
  presignUpload(key: string, contentType: string): Promise<string>;
  // Temporary URL to download the object.
  presignDownload(key: string): Promise<string>;
  // Object metadata; rejects when the object doesn't exist.
  head(key: string): Promise<{ size: number | null }>;
  getBuffer(key: string): Promise<Buffer>;
  upload(key: string, body: Buffer, contentType: string): Promise<void>;
  remove(key: string): Promise<void>;
}
