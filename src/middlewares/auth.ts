import type { NextFunction, Request, Response } from 'express';
import * as authService from '../modules/auth/auth.service.ts';
import type { RoleFlag } from '../db/models/enums.ts';
import type { UserInstance } from '../db/models/user.ts';
import type { SessionInstance } from '../db/models/session.ts';
import HttpError from '../utils/http-error.ts';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserInstance;
      authSession?: SessionInstance;
    }
  }
}

// Requires `Authorization: Bearer <token>`; sets req.user and req.authSession.
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Missing bearer token');

  const { session, user } = await authService.validateToken(token);
  req.user = user;
  req.authSession = session;
  next();
}

// Use after authenticate: authorize('SUPERADMIN', 'APP_ADMIN'). Compares the "Role"."code" of the
// token's user (loaded with the session by validateToken).
export function authorize(...roles: RoleFlag[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const code = req.user?.role?.code as RoleFlag | undefined;
    if (!code || !roles.includes(code)) throw new HttpError(403, 'Forbidden');
    next();
  };
}
