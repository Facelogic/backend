import config from '../../config/index.ts';

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';

export interface MailRecipient {
  email: string;
  name?: string;
}

export interface SendMailInput {
  to: MailRecipient | MailRecipient[];
  subject: string;
  html: string;
  text?: string;
  tags?: string[];
}

// Sends a transactional email through Brevo's REST API. Throws if Brevo isn't configured or rejects the request.
// Returns Brevo's messageId.
export async function sendMail({ to, subject, html, text, tags }: SendMailInput): Promise<string> {
  const { brevoApiKey, senderEmail, senderName } = config.mail;
  if (!brevoApiKey || !senderEmail) throw new Error('Brevo no está configurado (BREVO_API_KEY / MAIL_SENDER_EMAIL)');

  const response = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': brevoApiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: Array.isArray(to) ? to : [to],
      subject,
      htmlContent: html,
      ...(text ? { textContent: text } : {}),
      ...(tags?.length ? { tags } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = (await response.json().catch(() => ({}))) as { messageId?: string; message?: string; code?: string };
  if (!response.ok) {
    throw new Error(`Brevo respondió ${response.status}: ${body.message ?? body.code ?? 'error desconocido'}`);
  }
  return body.messageId ?? '';
}
