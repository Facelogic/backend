import crypto from 'node:crypto';
import type { UserInstance } from '../interfaces/models/user.interface.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (value: unknown) => String(value ?? '').trim().toLowerCase();

export const isValidEmail = (email: string) => EMAIL_RE.test(email);

// Opaque bearer token handed to the client; only its hash is persisted.
export const generateToken = () => crypto.randomBytes(32).toString('base64url');

// Only the SHA-256 of the token is stored: a DB leak doesn't expose usable tokens.
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// Fields safe to send to clients (no password/PIN hashes or lockout state).
// "role" is the role code, present when the user was loaded with its "role" association.
export function toPublic(user: UserInstance) {
  const { id, email, name, roleId, schoolId, status, lastLoginAt } = user;
  return { id, email, name, roleId, role: user.role?.code ?? null, schoolId, status, lastLoginAt };
}
