import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import config from '../../config/index.ts';

const { s3 } = config;

const client = new S3Client({
  endpoint: s3.endpoint,
  region: s3.region,
  forcePathStyle: s3.forcePathStyle,
  credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
});

export const bucket = s3.bucket ?? '';

// Clients upload/download directly against storage; the API never streams the bytes.
export function presignUpload(key: string, contentType: string) {
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: s3.presignExpires,
  });
}

export function presignDownload(key: string) {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: s3.presignExpires });
}

export function head(key: string) {
  return client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
}

export async function getBuffer(key: string) {
  const { Body } = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!Body) throw new Error(`Empty object: ${key}`);
  return Buffer.from(await Body.transformToByteArray());
}

// Multipart upload (parallel parts, automatic retries) — used server-side by workers for large files.
export function upload(key: string, body: Buffer, contentType: string) {
  return new Upload({
    client,
    params: { Bucket: bucket, Key: key, Body: body, ContentType: contentType },
    queueSize: 4,
    partSize: 10 * 1024 * 1024,
  }).done();
}

export function remove(key: string) {
  return client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
