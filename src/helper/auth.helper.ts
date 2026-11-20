import crypto from 'node:crypto';
import type { UserInstance } from '../interfaces/models/user.interface.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmail = (value: unknown) => String(value ?? '').trim().toLowerCase();

export const isValidEmail = (email: string) => EMAIL_RE.test(email);

// Opaque bearer token handed to the client; only its hash is persisted.
export const generateToken = () => crypto.randomBytes(32).toString('base64url');

// Only the SHA-256 of the token is stored: a DB leak doesn't expose usable tokens.
export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// School of the session user (APP_ADMIN / DOOR_STAFF); null for SUPERADMIN.
export const SESSION_SCHOOL_ATTRIBUTES = ['id', 'name', 'slug'];

// Fields safe to send to clients (no password/PIN hashes or lockout state).
// "role" is the role code and "school" the { id, name, slug } of the user's school, present when the user
// was loaded with those associations (login and validateToken do).
export function toPublic(user: UserInstance) {
  const { id, email, name, roleId, schoolId, status, lastLoginAt } = user;
  const school = user.school ? { id: user.school.id, name: user.school.name, slug: user.school.slug } : null;
  return { id, email, name, roleId, role: user.role?.code ?? null, schoolId, school, status, lastLoginAt };
}
