import type { Request, Response } from 'express';
import * as staffService from './staff.service.ts';

export async function create(req: Request, res: Response) {
    const { id, userId, invitationSent } = await staffService.create(req.body ?? {}, req.user);
    res.status(200).json({ status: true, data: id, userId, invitationSent });
}

export async function listSimple(req: Request, res: Response) {
    const items = await staffService.listSimple(req.query.schoolId, req.user);
    res.status(200).json({ status: true, data: items });
}
