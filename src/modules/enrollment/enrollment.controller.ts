import type { Request, Response } from 'express';
import * as enrollmentService from './enrollment.service.ts';

export async function list(req: Request, res: Response) {
    const { name, personType, schoolId, page, pageSize } = req.query;
    const { items, pagination } = await enrollmentService.list({ name, personType, schoolId, page, pageSize }, req.user);
    res.status(200).json({ status: true, data: items, pagination });
}

export async function get(req: Request<{ id: string }>, res: Response) {
    const item = await enrollmentService.get(req.params.id, req.user);
    res.status(200).json({ status: true, data: item });
}

export async function create(req: Request, res: Response) {
    const id = await enrollmentService.create(req.body ?? {}, req.user);
    res.status(201).json({ status: true, data: id });
}

export async function update(req: Request<{ id: string }>, res: Response) {
    await enrollmentService.update(req.params.id, req.body ?? {}, req.user);
    res.status(200).json({ status: true, data: req.params.id });
}

export async function remove(req: Request<{ id: string }>, res: Response) {
    await enrollmentService.remove(req.params.id, req.user);
    res.status(200).json({ status: true, data: req.params.id });
}
