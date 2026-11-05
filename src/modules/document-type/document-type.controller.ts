import type { Request, Response } from 'express';
import * as documentTypeService from './document-type.service.ts';

export async function list(req: Request, res: Response) {
    const items = await documentTypeService.list();
    res.status(200).json({ status: true, data: items });
}
