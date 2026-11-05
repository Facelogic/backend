import type { Request, Response } from 'express';
import * as menuService from './menu.service.ts';

// Runs behind `authenticate`: the role comes from the user of the bearer token, never from the request.
export async function listMine(req: Request, res: Response) {
  const items = await menuService.listForRole(req.user!.roleId);
  res.status(200).json({ status: true, data: items });
}
