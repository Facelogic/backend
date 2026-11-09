import type { CookieOptions, Request, Response } from 'express';
import config from '../config/index.ts';

const { cookie } = config.auth;

// Same attributes on set and clear: browsers only delete a cookie whose path/domain/sameSite/secure match.
const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: cookie.secure,
  sameSite: cookie.sameSite,
  domain: cookie.domain,
  path: '/',
};

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(cookie.name, token, { ...baseOptions, expires: expiresAt });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(cookie.name, baseOptions);
}

// Express 5 has no built-in cookie parsing; only the session cookie is needed.
function readCookie(req: Request, name: string) {
  for (const part of (req.get('cookie') || '').split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1 || part.slice(0, eq).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// Session cookie first (browser); `Authorization: Bearer <token>` still works for non-browser clients.
export function getSessionToken(req: Request) {
  const fromCookie = readCookie(req, cookie.name);
  if (fromCookie) return fromCookie;
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  return scheme === 'Bearer' && token ? token : undefined;
}
