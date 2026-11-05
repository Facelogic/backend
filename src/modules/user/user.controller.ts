import type { Request, Response } from 'express';
import * as userService from './user.service.ts';

export async function create(req: Request, res: Response) {
    const userId = await userService.create(req.body);
    res.status(200).json({ status: true, data: userId });
}


export async function list(req: Request, res: Response) {
    const { name, roleId, schoolId, status } = req.query;
    const list = await userService.list({ name, roleId, schoolId, status }, req.user);
    res.status(200).json({ status: true, data: list });
}

export async function update(req: Request<{ id: string }>, res: Response) {
    await userService.update(req.params.id, req.body ?? {});
    res.status(200).json({ status: true, data: req.params.id });
}

export async function remove(req: Request<{ id: string }>, res: Response) {
    await userService.remove(req.params.id, req.user?.id);
    res.status(200).json({ status: true, data: req.params.id });
}
