import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import * as mediaService from './media.service.ts';
import { mimeFromName } from '../../helper/media.helper.ts';
import HttpError from '../../utils/http-error.ts';

// express-form-data (parse + stream, see app.ts) leaves each file in req.files as an fs.ReadStream over the
// temp file, so the original name and Content-Type are gone: the type comes from `mimeType` or the extension.
type UploadedFile = fs.ReadStream | { path: string; originalFilename?: string; headers?: Record<string, string> };

// Express 5 forwards rejected promises to the error handler, so no try/catch needed.
export async function createUpload(req: Request, res: Response) {
  const { mimeType, originalName, schoolId, stationId } = req.body ?? {};
  const target = await mediaService.resolveTarget(req.user, { schoolId, stationId });
  const { media, uploadUrl } = await mediaService.createUpload({ mimeType, originalName, ownerId: req.user!.id, ...target });
  res.status(201).json({ id: media.id, storageKey: media.storageKey, uploadUrl, method: 'PUT' });
}

export async function uploadDirect(req: Request, res: Response) {
  const target = await mediaService.resolveTarget(req.user, { schoolId: req.body?.schoolId, stationId: req.body?.stationId });
  const files = (req as Request & { files?: Record<string, UploadedFile | UploadedFile[]> }).files ?? {};
  const entry = files.file;
  const file = Array.isArray(entry) ? entry[0] : entry;
  if (!file) throw new HttpError(400, 'file es obligatorio (campo "file" de multipart/form-data)');

  const filePath = String(file.path);
  if (file instanceof fs.ReadStream) file.destroy();
  const fileInfo = file as { originalFilename?: string; headers?: Record<string, string> };

  const originalName = String(req.body?.originalName ?? '').trim() || fileInfo.originalFilename || path.basename(filePath);
  const mimeType =
    String(req.body?.mimeType ?? '').trim() || fileInfo.headers?.['content-type'] || mimeFromName(originalName) || mimeFromName(filePath);
  if (!mimeType) throw new HttpError(415, 'Tipo de archivo desconocido; envía "mimeType" o usa una extensión conocida');

  const buffer = await fs.promises.readFile(filePath);
  const media = await mediaService.uploadDirect({ buffer, mimeType, originalName, ownerId: req.user!.id, ...target });
  res.status(201).json(media);
}

export async function confirmUpload(req: Request<{ id: string }>, res: Response) {
  const media = await mediaService.confirmUpload(req.params.id, req.user);
  res.json(media);
}

export async function list(req: Request, res: Response) {
  const { serialCode, schoolId, stationId, dateFrom, dateTo, status, page, pageSize } = req.query;
  const { items, pagination } = await mediaService.list(req.user, {
    serialCode,
    schoolId,
    stationId,
    dateFrom,
    dateTo,
    status,
    page,
    pageSize,
  });
  res.status(200).json({ status: true, data: items, pagination });
}

export async function getOne(req: Request<{ id: string }>, res: Response) {
  const { media, url } = await mediaService.getWithUrl(req.params.id, req.user);
  res.json({ ...media.toJSON(), url });
}
