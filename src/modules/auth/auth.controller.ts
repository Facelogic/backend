import type { Request, Response } from 'express';
import { toPublic } from '../../helper/auth.helper.ts';
import * as authService from './auth.service.ts';

// Routes using these handlers run behind `authenticate`, so req.user / req.authSession are set.
export async function register(req: Request, res: Response) {
  const user = await authService.register(req.body);
  res.status(201).json(user);
}

export async function login(req: Request, res: Response) {
  const result = await authService.login(req.body);
  res.json(result);
}

export async function logout(req: Request, res: Response) {
  try {
    await authService.logout(req.authSession!);
    res.status(204).json('La sesión ha sido cerrada satisfactoriamente').end();
  }
  catch (err) {
    res.status(500).json('Hubo un inconveniente al cerrar sesión').end();
  }
}

export async function me(req: Request, res: Response) {
  res.json(toPublic(req.user!));
}
