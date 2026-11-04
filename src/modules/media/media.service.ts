import crypto from 'node:crypto';
import type { HeadObjectCommandOutput } from '@aws-sdk/client-s3';
import { Media } from '../../db/models/index.ts';
import * as storage from '../../services/storage/s3.storage.ts';
import { enqueueProcessing } from '../../services/queue/media.queue.ts';
import HttpError from '../../utils/http-error.ts';
import { buildKey, kindFor } from '../../helper/media.helper.ts';

interface CreateUploadInput {
  mimeType: string;
  originalName?: string;
  ownerId?: string;
}

export async function createUpload({ mimeType, originalName, ownerId }: CreateUploadInput) {
  const kind = kindFor(mimeType);
  if (!kind) throw new HttpError(415, `Unsupported media type: ${mimeType}`);

  const id = crypto.randomUUID();
  const storageKey = buildKey(kind, id, originalName);
  const media = await Media.create({ id, kind, mimeType, originalName, ownerId, storageKey, bucket: storage.bucket });
  const uploadUrl = await storage.presignUpload(storageKey, mimeType);

  return { media, uploadUrl };
}

export async function confirmUpload(id: string) {
  const media = await Media.findByPk(id);
  if (!media) throw new HttpError(404, 'Media not found');
  if (media.status !== 'pending') return media;

  let object: HeadObjectCommandOutput;
  try {
    object = await storage.head(media.storageKey);
  } catch {
    throw new HttpError(409, 'Object not found in storage; upload it first');
  }

  await media.update({ status: 'uploaded', sizeBytes: object.ContentLength ?? null });
  await enqueueProcessing(media.id);
  return media;
}

export async function getWithUrl(id: string) {
  const media = await Media.findByPk(id);
  if (!media) throw new HttpError(404, 'Media not found');
  const url = media.status === 'pending' ? null : await storage.presignDownload(media.storageKey);
  return { media, url };
}
