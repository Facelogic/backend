import path from 'node:path';
import type { MediaKind } from '../db/models/media.ts';
import type { MediaInstance } from '../interfaces/models/media.interface.ts';

const ALLOWED: Record<MediaKind, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
};

const MIME_BY_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

// MIME type from the file extension (multipart uploads lose the original Content-Type, see media.controller).
export function mimeFromName(name: string) {
  return MIME_BY_EXTENSION[path.extname(name).toLowerCase()];
}

export function kindFor(mimeType: string) {
  return (Object.keys(ALLOWED) as MediaKind[]).find((kind) => ALLOWED[kind].includes(mimeType));
}

// originals/{schoolId}/{kind}/{yyyy}/{mm}/{dd}/{uuid}.{ext} — one prefix per school (easy to list/delete a
// school's files); date prefixes spread keys and ease lifecycle rules.
export function buildKey(schoolId: string, kind: MediaKind, id: string, originalName?: string) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const ext = path.extname(originalName || '').toLowerCase();
  return `originals/${schoolId}/${kind}/${yyyy}/${mm}/${dd}/${id}${ext}`;
}

// originals/.../{uuid}.jpg -> derived/.../{uuid}/{variant}.{ext}
export function derivedKey(media: MediaInstance, variant: string, ext: string) {
  return media.storageKey.replace(/^originals\//, 'derived/').replace(/\.[^/.]+$/, '') + `/${variant}.${ext}`;
}
