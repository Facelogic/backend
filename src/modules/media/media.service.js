const crypto = require('node:crypto');
const path = require('node:path');
const { Media } = require('../../db/models');
const storage = require('../../services/storage/s3.storage');
const { enqueueProcessing } = require('../../services/queue/media.queue');
const HttpError = require('../../utils/http-error');

const ALLOWED = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
};

function kindFor(mimeType) {
  return Object.keys(ALLOWED).find((kind) => ALLOWED[kind].includes(mimeType));
}

// originals/{kind}/{yyyy}/{mm}/{dd}/{uuid}.{ext} — date prefixes spread keys and ease lifecycle rules.
function buildKey(kind, id, originalName) {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const ext = path.extname(originalName || '').toLowerCase();
  return `originals/${kind}/${yyyy}/${mm}/${dd}/${id}${ext}`;
}

async function createUpload({ mimeType, originalName, ownerId }) {
  const kind = kindFor(mimeType);
  if (!kind) throw new HttpError(415, `Unsupported media type: ${mimeType}`);

  const id = crypto.randomUUID();
  const storageKey = buildKey(kind, id, originalName);
  const media = await Media.create({ id, kind, mimeType, originalName, ownerId, storageKey, bucket: storage.bucket });
  const uploadUrl = await storage.presignUpload(storageKey, mimeType);

  return { media, uploadUrl };
}

async function confirmUpload(id) {
  const media = await Media.findByPk(id);
  if (!media) throw new HttpError(404, 'Media not found');
  if (media.status !== 'pending') return media;

  let object;
  try {
    object = await storage.head(media.storageKey);
  } catch {
    throw new HttpError(409, 'Object not found in storage; upload it first');
  }

  await media.update({ status: 'uploaded', sizeBytes: object.ContentLength });
  await enqueueProcessing(media.id);
  return media;
}

async function getWithUrl(id) {
  const media = await Media.findByPk(id);
  if (!media) throw new HttpError(404, 'Media not found');
  const url = media.status === 'pending' ? null : await storage.presignDownload(media.storageKey);
  return { media, url };
}

module.exports = { createUpload, confirmUpload, getWithUrl };
