import type { Request, Response } from 'express';
import * as attendanceService from './attendance.service.ts';

export async function list(req: Request, res: Response) {
    const { staffName, staffId, shiftId, shift, schoolId, dateFrom, dateTo, status, late, page, pageSize } = req.query;
    const { items, pagination } = await attendanceService.list(
        { staffName, staffId, shiftId, shift, schoolId, dateFrom, dateTo, status, late, page, pageSize },
        req.user,
    );
    res.status(200).json({ status: true, data: items, pagination });
}

export async function create(req: Request, res: Response) {
    const created = await attendanceService.create(req.body ?? {}, req.user);
    res.status(201).json({ status: true, data: created });
}
