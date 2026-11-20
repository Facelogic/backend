// HTML email inviting a new user to set their password.
// Table-based layout with inline styles so it renders in Gmail, Outlook and mobile clients.

export interface InvitationTemplateData {
  name: string;
  email: string;
  schoolName?: string | null;
  roleName?: string | null;
  acceptUrl: string;
  expiresInHours: number;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function expiresLabel(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? '24 horas' : `${days} días`;
  }
  return hours === 1 ? '1 hora' : `${hours} horas`;
}

export function invitationSubject(): string {
  return 'Te invitamos a Facelogic: activa tu cuenta';
}

export function invitationHtml(data: InvitationTemplateData): string {
  const name = escapeHtml(data.name);
  const email = escapeHtml(data.email);
  const url = escapeHtml(data.acceptUrl);
  const expires = expiresLabel(data.expiresInHours);
  const details = [
    data.schoolName ? ['Colegio', escapeHtml(data.schoolName)] : null,
    data.roleName ? ['Rol', escapeHtml(data.roleName)] : null,
    ['Usuario', email],
  ].filter(Boolean) as [string, string][];

  const detailRows = details
    .map(
      ([label, value]) => `
                <tr>
                  <td style="padding:6px 0;font-size:14px;color:#64748b;width:90px;">${label}</td>
                  <td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;">${value}</td>
                </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Invitación a Facelogic</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Acepta tu invitación y crea tu contraseña para empezar a usar Facelogic.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
          <!-- Header -->
          <tr>
            <td align="center" style="background-color:#1e3a8a;background-image:linear-gradient(135deg,#1e3a8a,#2563eb);padding:32px 24px;">
              <div style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">Facelogic</div>
              <div style="font-size:14px;color:#bfdbfe;margin-top:6px;">Control de asistencia con reconocimiento facial</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 8px 40px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;color:#0f172a;">¡Hola, ${name}!</h1>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:#334155;">
                Has sido invitado a unirte a <strong>Facelogic</strong>. Para activar tu cuenta, acepta la invitación
                y establece tu contraseña de acceso.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:8px 0 24px 0;">
                <tr>
                  <td style="padding:14px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailRows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Button -->
          <tr>
            <td align="center" style="padding:0 40px 28px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#2563eb" style="border-radius:8px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${url}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" fillcolor="#2563eb" stroke="f">
                      <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">Aceptar invitación</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${url}" target="_blank" style="display:inline-block;padding:14px 40px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#2563eb;">
                      Aceptar invitación
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px 40px;">
              <p style="margin:0 0 12px 0;font-size:13px;line-height:20px;color:#64748b;">
                Este enlace es personal y vence en <strong>${expires}</strong>. Si el botón no funciona, copia y pega
                esta dirección en tu navegador:
              </p>
              <p style="margin:0;font-size:12px;line-height:18px;word-break:break-all;">
                <a href="${url}" target="_blank" style="color:#2563eb;text-decoration:underline;">${url}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;">
              <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8;">
                Si no esperabas esta invitación, puedes ignorar este correo; tu cuenta no se activará.
              </p>
              <p style="margin:8px 0 0 0;font-size:12px;line-height:18px;color:#94a3b8;">
                © ${new Date().getFullYear()} Facelogic. Este es un mensaje automático, por favor no respondas.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function invitationText(data: InvitationTemplateData): string {
  return [
    `Hola, ${data.name}:`,
    '',
    'Has sido invitado a unirte a Facelogic. Para activar tu cuenta, acepta la invitación y establece tu contraseña:',
    data.acceptUrl,
    '',
    `El enlace vence en ${expiresLabel(data.expiresInHours)}.`,
    'Si no esperabas esta invitación, ignora este correo.',
  ].join('\n');
}
