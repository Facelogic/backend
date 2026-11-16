import config from '../../config/index.ts';
import blobStorage from './blob.storage.ts';
import s3Storage from './s3.storage.ts';
import type { StorageDriver } from './storage.interface.ts';

// STORAGE_DRIVER=blob → Vercel Blob; anything else (default) → S3-compatible (MinIO locally, R2/S3).
const storage: StorageDriver = config.storageDriver === 'blob' ? blobStorage : s3Storage;

export default storage;
