import type { Request, Response } from 'express';
import * as schoolSettingsService from './school-settings.service.ts';

export async function getOwn(req: Request, res: Response) {
    const item = await schoolSettingsService.getOwn(req.user);
    res.status(200).json({ status: true, data: item });
}

export async function updateOwn(req: Request, res: Response) {
    const schoolId = await schoolSettingsService.updateOwn(req.body ?? {}, req.user);
    res.status(200).json({ status: true, data: schoolId });
}

export async function getBySchool(req: Request<{ schoolId: string }>, res: Response) {
    const item = await schoolSettingsService.getBySchool(req.params.schoolId);
    res.status(200).json({ status: true, data: item });
}

export async function updateBySuperadmin(req: Request<{ schoolId: string }>, res: Response) {
    await schoolSettingsService.updateBySuperadmin(req.params.schoolId, req.body ?? {});
    res.status(200).json({ status: true, data: req.params.schoolId });
}
