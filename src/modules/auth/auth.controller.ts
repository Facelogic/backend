import type { Request, Response } from 'express';
import { toPublic } from '../../helper/auth.helper.ts';
import { clearSessionCookie, getSessionToken, setSessionCookie } from '../../helper/session-cookie.ts';
import * as authService from './auth.service.ts';

// Routes using these handlers run behind `authenticate`, so req.user / req.authSession are set.
export async function register(req: Request, res: Response) {
  const user = await authService.register(req.body);
  res.status(201).json({ status: true, data: user });
}

// The token travels only in the httpOnly cookie, never in the body, so page scripts can't read it.
export async function login(req: Request, res: Response) {
  const { token, expiresAt, user } = await authService.login(req.body);
  setSessionCookie(res, token, expiresAt);
  res.status(200).json({ status: true, data: { expiresAt, user } });
}

// Not behind `authenticate`: an expired session must still be able to clear its cookie.
export async function logout(req: Request, res: Response) {
  const token = getSessionToken(req);
  if (token) await authService.logout(token);
  clearSessionCookie(res);
  res.status(200).json({ status: true, data: 'La sesión ha sido cerrada satisfactoriamente' });
}

export async function me(req: Request, res: Response) {
  res.status(200).json({ status: true, data: toPublic(req.user!) });
}
