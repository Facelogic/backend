import type { Request, Response } from 'express';
import * as shiftService from './shift.service.ts';

export async function list(req: Request, res: Response) {
    const { name, type, schoolId, page, pageSize } = req.query;
    const { items, pagination } = await shiftService.list({ name, type, schoolId, page, pageSize }, req.user);
    res.status(200).json({ status: true, data: items, pagination });
}

export async function create(req: Request, res: Response) {
    const id = await shiftService.create(req.body ?? {}, req.user);
    res.status(201).json({ status: true, data: id });
}

export async function get(req: Request<{ id: string }>, res: Response) {
    const item = await shiftService.get(req.params.id, req.user);
    res.status(200).json({ status: true, data: item });
}

export async function update(req: Request<{ id: string }>, res: Response) {
    await shiftService.update(req.params.id, req.body ?? {}, req.user);
    res.status(200).json({ status: true, data: req.params.id });
}

export async function remove(req: Request<{ id: string }>, res: Response) {
    await shiftService.remove(req.params.id, req.user);
    res.status(200).json({ status: true, data: req.params.id });
}
