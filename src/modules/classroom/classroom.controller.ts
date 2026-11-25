import type { Request, Response } from 'express';
import * as classroomService from './classroom.service.ts';

export async function list(req: Request, res: Response) {
    const { name, tutor, staffId, level, status, schoolId, page, pageSize } = req.query;
    const { items, pagination } = await classroomService.list({ name, tutor, staffId, level, status, schoolId, page, pageSize }, req.user);
    res.status(200).json({ status: true, data: items, pagination });
}

export async function get(req: Request<{ id: string }>, res: Response) {
    const item = await classroomService.get(req.params.id, req.user);
    res.status(200).json({ status: true, data: item });
}

export async function create(req: Request, res: Response) {
    const id = await classroomService.create(req.body ?? {}, req.user);
    res.status(201).json({ status: true, data: id });
}

export async function update(req: Request<{ id: string }>, res: Response) {
    await classroomService.update(req.params.id, req.body ?? {}, req.user);
    res.status(200).json({ status: true, data: req.params.id });
}

export async function remove(req: Request<{ id: string }>, res: Response) {
    await classroomService.remove(req.params.id, req.user);
    res.status(200).json({ status: true, data: req.params.id });
}
