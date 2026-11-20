import { sendMail } from './brevo.mail.ts';
import { invitationHtml, invitationSubject, invitationText, type InvitationTemplateData } from './templates/invitation.template.ts';

export { sendMail } from './brevo.mail.ts';

export async function sendInvitationEmail(data: InvitationTemplateData): Promise<string> {
  return sendMail({
    to: { email: data.email, name: data.name },
    subject: invitationSubject(),
    html: invitationHtml(data),
    text: invitationText(data),
    tags: ['invitation'],
  });
}
