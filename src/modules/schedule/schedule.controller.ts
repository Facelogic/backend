
import type { Request, Response } from 'express';
import * as scheduleService from './schedule.service.ts';

export async function create(req: Request, res: Response) {
    const id = await scheduleService.create(req.body ?? {});
    res.status(201).json({ status: true, data: id });
}

export async function bulkCreate(req: Request, res: Response) {
    const schedules = await scheduleService.bulkCreate(req.body);
    res.status(201).json({ status: true, data: schedules });
}
