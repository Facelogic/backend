import type { Request, Response } from 'express';
import * as userService from './user.service.ts';

export async function create(req: Request, res: Response) {
    const userId = await userService.create(req.body ?? {}, req.user);
    res.status(200).json({ status: true, data: userId });
}


export async function list(req: Request, res: Response) {
    const { name, roleId, schoolId, status, page, pageSize } = req.query;
    const { items, pagination } = await userService.list({ name, roleId, schoolId, status, page, pageSize }, req.user);
    res.status(200).json({ status: true, data: items, pagination });
}

export async function exportAll(req: Request, res: Response) {
    const { name, roleId, schoolId, status } = req.query;
    const rows = await userService.exportAll({ name, roleId, schoolId, status }, req.user);
    res.status(200).json({ status: true, data: rows });
}

export async function get(req: Request<{ id: string }>, res: Response) {
    const item = await userService.get(req.params.id, req.user);
    res.status(200).json({ status: true, data: item });
}

export async function update(req: Request<{ id: string }>, res: Response) {
    await userService.update(req.params.id, req.body ?? {});
    res.status(200).json({ status: true, data: req.params.id });
}

export async function changeStatus(req: Request<{ id: string }>, res: Response) {
    await userService.changeStatus(req.params.id, req.body ?? {}, req.user);
    res.status(200).json({ status: true, data: req.params.id });
}

export async function remove(req: Request<{ id: string }>, res: Response) {
    await userService.remove(req.params.id, req.user?.id);
    res.status(200).json({ status: true, data: req.params.id });
}
