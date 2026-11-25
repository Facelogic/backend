import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import * as pickupService from './pickup.service.ts';
import { mimeFromName } from '../../helper/media.helper.ts';
import type { PickupPhotoFile } from '../../interfaces/pickup.interface.ts';
import HttpError from '../../utils/http-error.ts';

// express-form-data (see app.ts) leaves each file in req.files as an fs.ReadStream over the temp file.
type UploadedFile = fs.ReadStream | { path: string; originalFilename?: string; headers?: Record<string, string> };

// Optional `photo` field of a multipart body.
async function readPhoto(req: Request): Promise<PickupPhotoFile | null> {
    const files = (req as Request & { files?: Record<string, UploadedFile | UploadedFile[]> }).files ?? {};
    const entry = files.photo;
    const file = Array.isArray(entry) ? entry[0] : entry;
    if (!file) return null;

    const filePath = String(file.path);
    if (file instanceof fs.ReadStream) file.destroy();
    const info = file as { originalFilename?: string; headers?: Record<string, string> };
    const originalName = info.originalFilename || path.basename(filePath);
    const mimeType = info.headers?.['content-type'] || mimeFromName(originalName) || mimeFromName(filePath);
    if (!mimeType) throw new HttpError(415, 'Tipo de foto desconocido; usa jpg, png o webp');

    return { buffer: await fs.promises.readFile(filePath), mimeType, originalName };
}

export async function list(req: Request, res: Response) {
    const { studentName, studentId, schoolId, stationId, dateFrom, dateTo, status, method, guardianNotified, page, pageSize } = req.query;
    const { items, pagination } = await pickupService.list(
        { studentName, studentId, schoolId, stationId, dateFrom, dateTo, status, method, guardianNotified, page, pageSize },
        req.user,
    );
    res.status(200).json({ status: true, data: items, pagination });
}

export async function create(req: Request, res: Response) {
    const photo = await readPhoto(req);
    const created = await pickupService.create(req.body ?? {}, photo, req.user);
    res.status(201).json({ status: true, data: created });
}
