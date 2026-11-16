import type { Request, Response } from 'express';
import * as roleService from './role.service.ts';

export async function list(req: Request, res: Response) {
    const items = await roleService.list();
    res.status(200).json({ status: true, data: items });
}
