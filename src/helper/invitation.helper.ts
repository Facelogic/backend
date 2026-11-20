import { Op } from 'sequelize';
import config from '../config/index.ts';
import { Invitation, Role, School } from '../db/models/index.ts';
import type { UserInstance } from '../interfaces/models/user.interface.ts';
import { sendInvitationEmail } from '../services/mail/index.ts';
import { generateToken, hashToken } from './auth.helper.ts';

// Link to the frontend "set password" form, with the raw token as ?token=...
export function buildAcceptUrl(token: string): string {
  const url = new URL(config.invitation.acceptUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

// Creates a fresh invitation for the user (previous pending ones are discarded, so only the
// latest link works) and emails it. Only the token hash is stored.
export async function issueInvitation(user: UserInstance): Promise<void> {
  const { ttlHours } = config.invitation;
  const token = generateToken();

  await Invitation.destroy({ where: { userId: user.id, usedAt: { [Op.is]: null } } });
  await Invitation.create({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlHours * 3_600_000),
  });

  const [role, school] = await Promise.all([
    Role.findByPk(user.roleId, { attributes: ['name'] }),
    user.schoolId ? School.findByPk(user.schoolId, { attributes: ['name'] }) : null,
  ]);

  await sendInvitationEmail({
    name: user.name,
    email: user.email,
    roleName: role?.name ?? null,
    schoolName: school?.name ?? null,
    acceptUrl: buildAcceptUrl(token),
    expiresInHours: ttlHours,
  });
}
