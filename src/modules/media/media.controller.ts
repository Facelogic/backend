import type { Request, Response } from 'express';
import * as mediaService from './media.service.ts';

// Express 5 forwards rejected promises to the error handler, so no try/catch needed.
export async function createUpload(req: Request, res: Response) {
  const { mimeType, originalName } = req.body;
  const { media, uploadUrl } = await mediaService.createUpload({ mimeType, originalName });
  res.status(201).json({ id: media.id, storageKey: media.storageKey, uploadUrl, method: 'PUT' });
}

export async function confirmUpload(req: Request<{ id: string }>, res: Response) {
  const media = await mediaService.confirmUpload(req.params.id);
  res.json(media);
}

export async function getOne(req: Request<{ id: string }>, res: Response) {
  const { media, url } = await mediaService.getWithUrl(req.params.id);
  res.json({ ...media.toJSON(), url });
}
