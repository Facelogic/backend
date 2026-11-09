import crypto from 'node:crypto';
import { UniqueConstraintError } from 'sequelize';
import config from '../../config/index.ts';
import { RoleFlag } from '../../db/models/enums.ts';
import { Role, Session, User } from '../../db/models/index.ts';
import { generateToken, hashToken, isValidEmail, normalizeEmail, toPublic } from '../../helper/auth.helper.ts';
import type { LoginInput, RegisterInput } from '../../interfaces/auth.interface.ts';
import { UserStatus } from '../../constants/user-status.ts';
import HttpError from '../../utils/http-error.ts';
import { hashPassword, verifyPassword } from '../../utils/password.ts';

const { auth } = config;

const MIN_PASSWORD = 8;
// Verified when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

export async function register(input: RegisterInput) {
  const email = normalizeEmail(input.email);
  const name = String(input.name ?? '').trim();
  const roleId = String(input.roleId ?? '').trim();
  const { password } = input;
  let schoolId = typeof input.schoolId === 'string' ? input.schoolId : null;

  if (!isValidEmail(email)) throw new HttpError(400, 'Invalid email');
  if (!name) throw new HttpError(400, 'Name is required');
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD} characters`);
  }

  const role = await Role.findByPk(roleId);

  if (!role) throw new HttpError(400, 'roleId should be a valid role');

  if (role?.code === RoleFlag[0]) schoolId = null;
  else if (!schoolId) throw new HttpError(400, 'schoolId is required for this role');

  try {
    const user = await User.create({
      email,
      name,
      roleId,
      schoolId,
      status: UserStatus.ACTIVE,
      passwordHash: await hashPassword(password),
    });
    return toPublic(user);
  } catch (err) {
    if (err instanceof UniqueConstraintError) throw new HttpError(409, 'Email already registered');
    throw err;
  }
}

export async function login(input: LoginInput) {
  const email = normalizeEmail(input.email);
  const { password } = input;
  if (!email || typeof password !== 'string') throw new HttpError(400, 'Email and password are required');

  const user = await User.findOne({ where: { email }, include: [{ model: Role, as: 'role' }] });
  if (!user?.passwordHash) {
    await verifyPassword(password, await DUMMY_HASH);
    throw new HttpError(401, 'Invalid credentials');
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(423, 'Account temporarily locked, try again later');
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failedAttempts = user.failedAttempts + 1;
    const locked = failedAttempts >= auth.maxFailedAttempts;
    await user.update({
      failedAttempts: locked ? 0 : failedAttempts,
      lockedUntil: locked ? new Date(Date.now() + auth.lockMinutes * 60_000) : user.lockedUntil,
    });
    throw new HttpError(401, 'Invalid credentials');
  }
  if (user.status !== UserStatus.ACTIVE) throw new HttpError(403, 'Account is not active');

  const token = generateToken();
  const expiresAt = new Date(Date.now() + auth.sessionTtlHours * 3_600_000);
  await Session.create({ userId: user.id, tokenHash: hashToken(token), expiresAt });
  await user.update({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() });

  return { token, expiresAt, user: toPublic(user) };
}

// Resolves a bearer token to its session + user, or throws 401.
export async function validateToken(token: string) {
  const session = await Session.findOne({
    where: { tokenHash: hashToken(token) },
    include: [{ model: User, as: 'user', include: [{ model: Role, as: 'role' }] }],
  });
  if (!session?.user) throw new HttpError(401, 'Invalid token');
  if (session.expiresAt <= new Date()) {
    await session.destroy();
    throw new HttpError(401, 'Session expired');
  }
  if (session.user.status !== UserStatus.ACTIVE) throw new HttpError(401, 'Account is not active');

  // Throttled so authenticated requests don't each cost a write.
  if (Date.now() - session.lastActivityAt.getTime() > 60_000) {
    await session.update({ lastActivityAt: new Date() });
  }
  return { session, user: session.user };
}

// Deletes the session behind a token, if any. Unknown or expired tokens are a no-op, so logout
// always succeeds and the client cookie can be cleared regardless.
export async function logout(token: string) {
  try {
    await Session.destroy({ where: { tokenHash: hashToken(token) } });
  } catch (err) {
    throw new HttpError(500, 'Hubo un inconveniente al cerrar sesión');
  }
}
