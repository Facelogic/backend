import type { Request, Response } from 'express';
import * as schoolService from './school.service.ts';

export async function list(req: Request, res: Response) {
    const { name, status, page, pageSize } = req.query;
    const { items, pagination } = await schoolService.list({ name, status, page, pageSize });
    res.status(200).json({ status: true, data: items, pagination });
}

export async function listSimple(req: Request, res: Response) {
    const items = await schoolService.listSimple();
    res.status(200).json({ status: true, data: items });
}

export async function exportAll(req: Request, res: Response) {
    const { name, status } = req.query;
    const rows = await schoolService.exportAll({ name, status });
    res.status(200).json({ status: true, data: rows });
}

export async function get(req: Request<{ id: string }>, res: Response) {
    const item = await schoolService.get(req.params.id);
    res.status(200).json({ status: true, data: item });
}

export async function create(req: Request, res: Response) {
    const id = await schoolService.create(req.body ?? {});
    res.status(201).json({ status: true, data: id });
}

export async function update(req: Request<{ id: string }>, res: Response) {
    await schoolService.update(req.params.id, req.body ?? {});
    res.status(200).json({ status: true, data: req.params.id });
}

export async function changeStatus(req: Request<{ id: string }>, res: Response) {
    await schoolService.changeStatus(req.params.id, req.body ?? {});
    res.status(200).json({ status: true, data: req.params.id });
}

export async function remove(req: Request<{ id: string }>, res: Response) {
    await schoolService.remove(req.params.id);
    res.status(200).json({ status: true, data: req.params.id });
}
