import { del, get, head as blobHead, issueSignedToken, presignUrl, put, type DelegationOperation } from '@vercel/blob';
import config from '../../config/index.ts';
import type { StorageDriver } from './storage.interface.ts';

// Vercel Blob (private store). Auth is resolved by the SDK: on Vercel, OIDC + BLOB_STORE_ID of the
// connected store; locally, BLOB_READ_WRITE_TOKEN (`vercel env pull`).
const access = 'private' as const;
const { blob } = config;

// Short-lived token scoped to one pathname and the given operations; presigned URLs expire with it.
async function signFor(pathname: string, operations: DelegationOperation[], contentType?: string) {
  const validUntil = Date.now() + blob.presignExpires * 1000;
  const token = await issueSignedToken({
    pathname,
    operations,
    validUntil,
    ...(contentType && { allowedContentTypes: [contentType] }),
  });
  return { token, validUntil };
}

const blobStorage: StorageDriver = {
  bucket: blob.storeId || 'vercel-blob',

  // Clients upload/download directly against Blob; the API never streams the bytes.
  async presignUpload(key, contentType) {
    const { token, validUntil } = await signFor(key, ['put'], contentType);
    const { presignedUrl } = await presignUrl(token, {
      operation: 'put',
      pathname: key,
      validUntil,
      access,
      allowedContentTypes: [contentType],
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return presignedUrl;
  },

  async presignDownload(key) {
    const { token, validUntil } = await signFor(key, ['get']);
    const { presignedUrl } = await presignUrl(token, { operation: 'get', pathname: key, validUntil, access });
    return presignedUrl;
  },

  // Throws (BlobNotFoundError) when the object doesn't exist.
  async head(key) {
    const { size } = await blobHead(key);
    return { size };
  },

  async getBuffer(key) {
    const result = await get(key, { access, useCache: false });
    if (!result || result.statusCode !== 200) throw new Error(`Object not found: ${key}`);
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  },

  // Server-side upload used by the workers; multipart for large files (parallel parts, retries).
  async upload(key, body, contentType) {
    await put(key, body, {
      access,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      multipart: body.length > 10 * 1024 * 1024,
    });
  },

  async remove(key) {
    await del(key);
  },
};

export default blobStorage;
