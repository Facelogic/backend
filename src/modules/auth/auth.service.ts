import crypto from 'node:crypto';
import { UniqueConstraintError } from 'sequelize';
import config from '../../config/index.ts';
import { RoleFlag } from '../../db/models/enums.ts';
import { Invitation, Role, School, sequelize, Session, User } from '../../db/models/index.ts';
import { generateToken, hashToken, isValidEmail, normalizeEmail, SESSION_SCHOOL_ATTRIBUTES, toPublic } from '../../helper/auth.helper.ts';
import type { AcceptInvitationInput, LoginInput, RegisterInput } from '../../interfaces/auth.interface.ts';
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

  if (!isValidEmail(email)) throw new HttpError(400, 'Correo electrónico inválido');
  if (!name) throw new HttpError(400, 'El nombre es obligatorio');
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    throw new HttpError(400, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`);
  }

  const role = await Role.findByPk(roleId);

  if (!role) throw new HttpError(400, 'roleId debe ser un rol válido');

  if (role?.code === RoleFlag[0]) schoolId = null;
  else if (!schoolId) throw new HttpError(400, 'schoolId es obligatorio para este rol');

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
    if (err instanceof UniqueConstraintError) throw new HttpError(409, 'El correo electrónico ya está registrado');
    throw err;
  }
}

export async function login(input: LoginInput) {
  const email = normalizeEmail(input.email);
  const { password } = input;
  if (!email || typeof password !== 'string') throw new HttpError(400, 'El correo electrónico y la contraseña son obligatorios');

  const user = await User.findOne({
    where: { email },
    include: [{ model: Role, as: 'role' }, { model: School, as: 'school', attributes: SESSION_SCHOOL_ATTRIBUTES }],
  });
  if (!user?.passwordHash) {
    await verifyPassword(password, await DUMMY_HASH);
    throw new HttpError(401, 'Credenciales inválidas');
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(423, 'Cuenta bloqueada temporalmente, inténtalo más tarde');
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failedAttempts = user.failedAttempts + 1;
    const locked = failedAttempts >= auth.maxFailedAttempts;
    await user.update({
      failedAttempts: locked ? 0 : failedAttempts,
      lockedUntil: locked ? new Date(Date.now() + auth.lockMinutes * 60_000) : user.lockedUntil,
    });
    throw new HttpError(401, 'Credenciales inválidas');
  }
  if (user.status !== UserStatus.ACTIVE) throw new HttpError(403, 'La cuenta no está activa');

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
    include: [{
      model: User,
      as: 'user',
      include: [{ model: Role, as: 'role' }, { model: School, as: 'school', attributes: SESSION_SCHOOL_ATTRIBUTES }],
    }],
  });
  if (!session?.user) throw new HttpError(401, 'Token inválido');
  if (session.expiresAt <= new Date()) {
    await session.destroy();
    throw new HttpError(401, 'La sesión ha expirado');
  }
  if (session.user.status !== UserStatus.ACTIVE) throw new HttpError(401, 'La cuenta no está activa');

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

// Loads a pending invitation by its raw token (from the email link) or throws.
async function findPendingInvitation(token: unknown) {
  if (typeof token !== 'string' || !token.trim()) throw new HttpError(400, 'El token de invitación es obligatorio');
  const invitation = await Invitation.findOne({
    where: { tokenHash: hashToken(token.trim()) },
    include: [{
      model: User,
      as: 'user',
      include: [{ model: Role, as: 'role', attributes: ['name', 'code'] }, { model: School, as: 'school', attributes: ['name'] }],
    }],
  });
  if (!invitation?.user) throw new HttpError(404, 'La invitación no existe o ya no es válida');
  if (invitation.usedAt) throw new HttpError(410, 'La invitación ya fue utilizada');
  if (invitation.expiresAt <= new Date()) throw new HttpError(410, 'La invitación ha expirado, solicita una nueva');
  if (invitation.user.status !== UserStatus.INVITED) throw new HttpError(410, 'La invitación ya no es válida');
  return invitation as typeof invitation & { user: NonNullable<typeof invitation.user> };
}

// Data shown by the "set password" page before the user submits the form.
export async function getInvitation(token: unknown) {
  const { user, expiresAt } = await findPendingInvitation(token);
  return {
    name: user.name,
    email: user.email,
    role: user.role?.name ?? null,
    school: user.school?.name ?? null,
    expiresAt,
  };
}

// Sets the password of an invited user and activates the account. The invitation can only be used once.
export async function acceptInvitation(input: AcceptInvitationInput) {
  const { password, confirmPassword } = input;
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    throw new HttpError(400, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`);
  }
  if (confirmPassword !== undefined && confirmPassword !== password) {
    throw new HttpError(400, 'Las contraseñas no coinciden');
  }

  const invitation = await findPendingInvitation(input.token);
  const passwordHash = await hashPassword(password);

  await sequelize.transaction(async (transaction) => {
    // Guarded update so two concurrent submits can't both consume the same invitation.
    const [used] = await Invitation.update(
      { usedAt: new Date() },
      { where: { id: invitation.id, usedAt: null }, transaction },
    );
    if (!used) throw new HttpError(410, 'La invitación ya fue utilizada');
    await invitation.user.update(
      { passwordHash, status: UserStatus.ACTIVE, failedAttempts: 0, lockedUntil: null },
      { transaction },
    );
  });

  return { email: invitation.user.email };
}
