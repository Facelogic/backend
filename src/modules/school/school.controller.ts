import type { Request, Response } from 'express';
import * as schoolService from './school.service.ts';

export async function list(req: Request, res: Response) {
    const { name, status } = req.query;
    const items = await schoolService.list({ name, status });
    res.status(200).json({ status: true, data: items });
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

export async function remove(req: Request<{ id: string }>, res: Response) {
    await schoolService.remove(req.params.id);
    res.status(200).json({ status: true, data: req.params.id });
}
