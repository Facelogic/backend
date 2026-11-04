import path from 'node:path';
import type { MediaInstance, MediaKind } from '../db/models/media.ts';

const ALLOWED: Record<MediaKind, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
};

export function kindFor(mimeType: string) {
  return (Object.keys(ALLOWED) as MediaKind[]).find((kind) => ALLOWED[kind].includes(mimeType));
}

// originals/{kind}/{yyyy}/{mm}/{dd}/{uuid}.{ext} — date prefixes spread keys and ease lifecycle rules.
export function buildKey(kind: MediaKind, id: string, originalName?: string) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const ext = path.extname(originalName || '').toLowerCase();
  return `originals/${kind}/${yyyy}/${mm}/${dd}/${id}${ext}`;
}

// originals/.../{uuid}.jpg -> derived/.../{uuid}/{variant}.{ext}
export function derivedKey(media: MediaInstance, variant: string, ext: string) {
  return media.storageKey.replace(/^originals\//, 'derived/').replace(/\.[^/.]+$/, '') + `/${variant}.${ext}`;
}
