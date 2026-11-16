import crypto from 'node:crypto';
import { ForeignKeyConstraintError } from 'sequelize';
import { Media, School, Station } from '../../db/models/index.ts';
import storage from '../../services/storage/index.ts';
import { enqueueProcessing } from '../../services/queue/media.queue.ts';
import HttpError from '../../utils/http-error.ts';
import { buildKey, kindFor } from '../../helper/media.helper.ts';
import type { CreateUploadInput, DirectUploadInput, MediaTarget } from '../../interfaces/media.interface.ts';
import type { UserInstance } from '../../interfaces/models/user.interface.ts';
import { isUuid } from '../../utils/text.util.ts';

// School and station a new file is linked to.
// - stationId is optional; when sent, the station must exist and belong to the file's school.
// - A SUPERADMIN sends schoolId (any school); if omitted, the station's school is used.
// - Any other role always uses its own school (a schoolId in the body is ignored).
export async function resolveTarget(
  currentUser: UserInstance | undefined,
  input: { schoolId?: unknown; stationId?: unknown },
): Promise<MediaTarget> {
  if (!currentUser) throw new HttpError(401, 'No autenticado');

  const rawStationId = String(input.stationId ?? '').trim();
  let station: { schoolId: string } | null = null;
  if (rawStationId) {
    if (!isUuid(rawStationId)) throw new HttpError(400, 'stationId inválido');
    station = await Station.findByPk(rawStationId, { attributes: ['id', 'schoolId'] });
    if (!station) throw new HttpError(400, 'Estación no encontrada');
  }

  let schoolId: string;
  if (currentUser.role?.code === 'SUPERADMIN') {
    schoolId = String(input.schoolId ?? '').trim() || station?.schoolId || '';
    if (!isUuid(schoolId)) throw new HttpError(400, 'schoolId es obligatorio (uuid)');
  } else {
    if (!currentUser.schoolId) throw new HttpError(403, 'La cuenta no tiene un colegio asignado');
    schoolId = currentUser.schoolId;
  }

  if (station && station.schoolId !== schoolId) throw new HttpError(400, 'La estación no pertenece al colegio');
  return { schoolId, stationId: station ? rawStationId : null };
}

// A non-SUPERADMIN only sees the files of its own school (404 to not reveal other schools' files).
async function findAccessible(id: string, currentUser?: UserInstance) {
  const media = isUuid(id) ? await Media.findByPk(id) : null;
  if (!media) throw new HttpError(404, 'Archivo multimedia no encontrado');
  if (currentUser?.role?.code !== 'SUPERADMIN' && media.schoolId !== currentUser?.schoolId) {
    throw new HttpError(404, 'Archivo multimedia no encontrado');
  }
  return media;
}

function handleCreateError(err: unknown): never {
  if (err instanceof ForeignKeyConstraintError) throw new HttpError(400, 'Colegio, estación o usuario no encontrado');
  throw err;
}

export async function createUpload({ mimeType, originalName, ownerId, schoolId, stationId }: CreateUploadInput) {
  const kind = kindFor(mimeType);
  if (!kind) throw new HttpError(415, `Tipo de archivo no soportado: ${mimeType}`);

  const id = crypto.randomUUID();
  const storageKey = buildKey(schoolId, kind, id, originalName);
  const media = await Media.create({
    id,
    kind,
    mimeType,
    originalName,
    ownerId,
    schoolId,
    stationId,
    storageKey,
    bucket: storage.bucket,
  }).catch(
    handleCreateError,
  );
  const uploadUrl = await storage.presignUpload(storageKey, mimeType);

  return { media, uploadUrl };
}

// Upload through the API (multipart): the file is stored server-side and the media is created already "uploaded".
// Handy for Swagger and small files; on Vercel the request body is limited to 4.5 MB, so the frontend
// should keep using the presigned flow (createUpload + confirmUpload) for videos.
export async function uploadDirect({ buffer, mimeType, originalName, ownerId, schoolId, stationId }: DirectUploadInput) {
  const kind = kindFor(mimeType);
  if (!kind) throw new HttpError(415, `Tipo de archivo no soportado: ${mimeType}`);
  if (!buffer.length) throw new HttpError(400, 'El archivo está vacío');

  // Checked before uploading so an unknown school doesn't leave an orphan object in storage.
  if (!(await School.findByPk(schoolId, { attributes: ['id'] }))) throw new HttpError(400, 'Colegio no encontrado');

  const id = crypto.randomUUID();
  const storageKey = buildKey(schoolId, kind, id, originalName);
  await storage.upload(storageKey, buffer, mimeType);

  const media = await Media.create({
    id,
    kind,
    mimeType,
    originalName,
    ownerId,
    schoolId,
    stationId,
    storageKey,
    bucket: storage.bucket,
    status: 'uploaded',
    sizeBytes: buffer.length,
  }).catch(handleCreateError);
  await enqueueProcessing(media.id);
  return media;
}

export async function confirmUpload(id: string, currentUser?: UserInstance) {
  const media = await findAccessible(id, currentUser);
  if (media.status !== 'pending') return media;

  let object: { size: number | null };
  try {
    object = await storage.head(media.storageKey);
  } catch {
    throw new HttpError(409, 'El objeto no existe en el almacenamiento; súbelo primero');
  }

  await media.update({ status: 'uploaded', sizeBytes: object.size });
  await enqueueProcessing(media.id);
  return media;
}

export async function getWithUrl(id: string, currentUser?: UserInstance) {
  const media = await findAccessible(id, currentUser);
  const url = media.status === 'pending' ? null : await storage.presignDownload(media.storageKey);
  return { media, url };
}
