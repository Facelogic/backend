import type { Request, Response } from 'express';
import * as studentService from './student.service.ts';

export async function list(req: Request, res: Response) {
    const { name, level, schoolId, page, pageSize } = req.query;
    const { items, pagination } = await studentService.list({ name, level, schoolId, page, pageSize }, req.user);
    res.status(200).json({ status: true, data: items, pagination });
}

export async function exportAll(req: Request, res: Response) {
    const { name, level, schoolId } = req.query;
    const rows = await studentService.exportAll({ name, level, schoolId }, req.user);
    res.status(200).json({ status: true, data: rows });
}

export async function get(req: Request<{ id: string }>, res: Response) {
    const item = await studentService.get(req.params.id, req.user);
    res.status(200).json({ status: true, data: item });
}

export async function create(req: Request, res: Response) {
    const id = await studentService.create(req.body ?? {}, req.user);
    res.status(201).json({ status: true, data: id });
}

export async function update(req: Request<{ id: string }>, res: Response) {
    await studentService.update(req.params.id, req.body ?? {}, req.user);
    res.status(200).json({ status: true, data: req.params.id });
}

export async function remove(req: Request<{ id: string }>, res: Response) {
    await studentService.remove(req.params.id, req.user);
    res.status(200).json({ status: true, data: req.params.id });
}
