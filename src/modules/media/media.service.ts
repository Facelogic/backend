import crypto from 'node:crypto';
import { ForeignKeyConstraintError, Op, type WhereOptions } from 'sequelize';
import { Media, School, Station } from '../../db/models/index.ts';
import { MediaStatus } from '../../db/models/media.ts';
import storage from '../../services/storage/index.ts';
import { enqueueProcessing } from '../../services/queue/media.queue.ts';
import HttpError from '../../utils/http-error.ts';
import { buildKey, kindFor } from '../../helper/media.helper.ts';
import type {
  CreateUploadInput,
  DirectUploadInput,
  MediaListFilters,
  MediaListItem,
  MediaTarget,
} from '../../interfaces/media.interface.ts';
import type { MediaAttributes, MediaInstance } from '../../interfaces/models/media.interface.ts';
import type { UserInstance } from '../../interfaces/models/user.interface.ts';
import { containsPattern, initials, isUuid } from '../../utils/text.util.ts';
import { limaCompactDate, limaDate, limaDayStart, limaTime } from '../../utils/date.util.ts';
import { parsePagination, toPaginated, type Paginated } from '../../utils/pagination.util.ts';

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

// Preview of a list item: the thumbnail (images) or poster frame (videos) made by the worker, or the original
// while it hasn't been processed yet. null while pending (the object isn't in storage yet).
function previewUrl(media: MediaInstance): Promise<string | null> {
  if (media.status === 'pending') return Promise.resolve(null);
  const key = media.variants?.thumb ?? media.variants?.poster ?? media.storageKey;
  return storage.presignDownload(key);
}

async function toListItem(media: MediaInstance): Promise<MediaListItem> {
  const school = media.school?.name ?? '';
  return {
    id: media.id,
    thumbnailUrl: await previewUrl(media),
    serialCode: media.serialCode,
    code: `${initials(school)}${limaCompactDate(media.createdAt)}`,
    savedAt: media.createdAt.toISOString(),
    date: limaDate(media.createdAt),
    time: limaTime(media.createdAt),
    school,
    station: media.station?.name ?? null,
    status: media.status,
  };
}

function parseUuidFilter(field: string, raw: unknown): string | undefined {
  const value = String(raw ?? '').trim();
  if (!value) return undefined;
  if (!isUuid(value)) throw new HttpError(400, `${field} inválido`);
  return value;
}

// "yyyy-mm-dd" (Lima day) -> start of that day; with endOfDay, the start of the next day (exclusive bound).
function parseDayFilter(field: string, raw: unknown, endOfDay = false): Date | undefined {
  const value = String(raw ?? '').trim();
  if (!value) return undefined;
  const start = limaDayStart(value);
  if (!start) throw new HttpError(400, `${field} debe tener el formato yyyy-mm-dd`);
  return endOfDay ? new Date(start.getTime() + 24 * 60 * 60 * 1000) : start;
}

// Newest first, paginated. Filters: serialCode (part of it), schoolId, stationId, dateFrom/dateTo (Lima days,
// both inclusive) and status. A non-SUPERADMIN only sees its own school (a schoolId in the query is ignored).
export async function list(currentUser: UserInstance | undefined, filters: MediaListFilters = {}): Promise<Paginated<MediaListItem>> {
  if (!currentUser) throw new HttpError(401, 'No autenticado');
  const { page, pageSize, limit, offset } = parsePagination(filters);
  const where: WhereOptions<MediaAttributes> = {};

  if (currentUser.role?.code === 'SUPERADMIN') {
    const schoolId = parseUuidFilter('schoolId', filters.schoolId);
    if (schoolId) where.schoolId = schoolId;
  } else {
    if (!currentUser.schoolId) throw new HttpError(403, 'La cuenta no tiene un colegio asignado');
    where.schoolId = currentUser.schoolId;
  }

  const stationId = parseUuidFilter('stationId', filters.stationId);
  if (stationId) where.stationId = stationId;

  const status = String(filters.status ?? '').trim();
  if (status) {
    if (!(MediaStatus as readonly string[]).includes(status)) {
      throw new HttpError(400, `status debe ser uno de ${MediaStatus.join(', ')}`);
    }
    where.status = status as MediaStatus;
  }

  const serialCode = String(filters.serialCode ?? '').trim();
  if (serialCode) where.serialCode = { [Op.iLike]: containsPattern(serialCode) };

  const dateFrom = parseDayFilter('dateFrom', filters.dateFrom);
  const dateTo = parseDayFilter('dateTo', filters.dateTo, true);
  if (dateFrom && dateTo && dateFrom >= dateTo) throw new HttpError(400, 'dateFrom no puede ser posterior a dateTo');
  if (dateFrom || dateTo) {
    (where as Record<string, unknown>).createdAt = {
      ...(dateFrom && { [Op.gte]: dateFrom }),
      ...(dateTo && { [Op.lt]: dateTo }),
    };
  }

  const { rows, count } = await Media.findAndCountAll({
    where,
    attributes: ['id', 'status', 'createdAt', 'schoolId', 'stationId', 'storageKey', 'variants', 'serialCode'],
    include: [
      { model: School, as: 'school', attributes: ['name'] },
      { model: Station, as: 'station', attributes: ['name'] },
    ],
    order: [['createdAt', 'DESC'], ['id', 'ASC']],
    distinct: true,
    limit,
    offset,
  });
  return toPaginated(await Promise.all(rows.map(toListItem)), count, page, pageSize);
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
