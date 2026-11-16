import type { Request, Response } from 'express';
import * as stationService from './station.service.ts';

export async function list(req: Request, res: Response) {
    const { name, schoolId, status, page, pageSize } = req.query;
    const { items, pagination } = await stationService.list({ name, schoolId, status, page, pageSize });
    res.status(200).json({ status: true, data: items, pagination });
}

export async function get(req: Request<{ id: string }>, res: Response) {
    const item = await stationService.get(req.params.id);
    res.status(200).json({ status: true, data: item });
}

export async function create(req: Request, res: Response) {
    const id = await stationService.create(req.body ?? {});
    res.status(201).json({ status: true, data: id });
}

export async function update(req: Request<{ id: string }>, res: Response) {
    await stationService.update(req.params.id, req.body ?? {});
    res.status(200).json({ status: true, data: req.params.id });
}

export async function remove(req: Request<{ id: string }>, res: Response) {
    await stationService.remove(req.params.id);
    res.status(200).json({ status: true, data: req.params.id });
}

export async function changeStatus(req: Request<{ id: string }>, res: Response) {
    await stationService.changeStatus(req.params.id, req.body ?? {});
    res.status(200).json({ status: true, data: req.params.id });
}

export async function exportAll(req: Request, res: Response) {
    const { name, schoolId, status } = req.query;
    const rows = await stationService.exportAll({ name, schoolId, status });
    res.status(200).json({ status: true, data: rows });
}
