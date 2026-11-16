import type { Request, Response } from 'express';
import * as dashboardService from './dashboard.service.ts';

export async function schoolSummary(req: Request, res: Response) {
    const summary = await dashboardService.schoolSummary();
    res.status(200).json({ status: true, data: summary });
}

export async function userSummary(req: Request, res: Response) {
    const summary = await dashboardService.userSummary();
    res.status(200).json({ status: true, data: summary });
}

export async function stationSummary(req: Request, res: Response) {
    const summary = await dashboardService.stationSummary();
    res.status(200).json({ status: true, data: summary });
}
