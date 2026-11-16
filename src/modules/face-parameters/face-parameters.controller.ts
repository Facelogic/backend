import type { Request, Response } from 'express';
import * as faceParametersService from './face-parameters.service.ts';

export async function getLatest(req: Request, res: Response) {
    const item = await faceParametersService.getLatest();
    res.status(200).json({ status: true, data: item });
}

export async function getByVersion(req: Request<{ version: string }>, res: Response) {
    const item = await faceParametersService.getByVersion(req.params.version);
    res.status(200).json({ status: true, data: item });
}

export async function create(req: Request, res: Response) {
    const version = await faceParametersService.create(req.body ?? {}, req.user?.id);
    res.status(201).json({ status: true, data: version });
}

export async function update(req: Request<{ version: string }>, res: Response) {
    await faceParametersService.update(req.params.version, req.body ?? {});
    res.status(200).json({ status: true, data: Number(req.params.version) });
}
