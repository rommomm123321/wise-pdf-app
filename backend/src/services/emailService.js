/**
 * Email service using nodemailer (if configured via environment variables).
 * Required env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Optional: SMTP_FROM (defaults to SMTP_USER), APP_NAME (defaults to 'Redlines')
 */
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  try {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransporter({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587'),
      secure: parseInt(SMTP_PORT || '587') === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.verify();
    return transporter;
  } catch (err) {
    console.warn('[Email] SMTP configuration invalid:', err.message);
    transporter = null;
    return null;
  }
}

function buildInvitationEmail({ inviteUrl, companyName, roleName, inviterName, expiresAt, recipientEmail }) {
  const appName = process.env.APP_NAME || 'Redlines';
  const expiry = expiresAt ? new Date(expiresAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '7 days';
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>You're invited to ${appName}</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 20px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">

      <!-- Header with gradient -->
      <tr>
        <td style="background:linear-gradient(135deg,#1a1a1a 0%,#1f1a0e 100%);padding:40px 40px 32px;text-align:center;border-bottom:1px solid #2a2a2a;">
          <div style="display:inline-block;background:#c9a227;width:48px;height:48px;border-radius:12px;line-height:48px;text-align:center;font-size:22px;font-weight:900;color:#000;margin-bottom:16px;">R</div>
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px;">${appName}</h1>
          <p style="margin:8px 0 0;color:#9a9a9a;font-size:14px;">Collaborative PDF Annotation Platform</p>
        </td>
      </tr>

      <!-- Main content -->
      <tr>
        <td style="padding:40px;">
          <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#fff;">You've been invited!</h2>
          <p style="margin:0 0 24px;color:#9a9a9a;font-size:15px;line-height:1.6;">
            ${inviterName ? `<strong style="color:#c9a227;">${inviterName}</strong> has invited you to join` : "You've been invited to join"}
            <strong style="color:#fff;"> ${companyName}</strong> on ${appName}
            ${roleName ? ` as <strong style="color:#c9a227;">${roleName}</strong>` : ''}.
          </p>

          <!-- Role badge -->
          ${roleName ? `
          <div style="background:#111;border:1px solid #2a2a2a;border-radius:10px;padding:16px 20px;margin-bottom:28px;display:flex;align-items:center;gap:12px;">
            <div style="background:rgba(201,162,39,0.15);border:1px solid rgba(201,162,39,0.3);border-radius:8px;padding:8px 14px;display:inline-block;">
              <span style="color:#c9a227;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Your Role</span>
              <div style="color:#fff;font-size:16px;font-weight:600;margin-top:4px;">${roleName}</div>
            </div>
          </div>` : ''}

          <!-- CTA button -->
          <div style="text-align:center;margin:32px 0;">
            <a href="${inviteUrl}" style="display:inline-block;background:#c9a227;color:#000;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;letter-spacing:0.3px;">
              Accept Invitation →
            </a>
          </div>

          <!-- Link fallback -->
          <div style="background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:14px;margin-bottom:24px;">
            <p style="margin:0 0 6px;font-size:12px;color:#666;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Or copy this link</p>
            <p style="margin:0;font-size:12px;color:#c9a227;word-break:break-all;font-family:monospace;">${inviteUrl}</p>
          </div>

          <!-- Expiry notice -->
          <p style="margin:0;color:#666;font-size:13px;text-align:center;">
            ⏱ This invitation expires on <strong style="color:#9a9a9a;">${expiry}</strong>
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#111;padding:24px 40px;border-top:1px solid #2a2a2a;text-align:center;">
          <p style="margin:0;color:#555;font-size:12px;line-height:1.7;">
            This email was sent to <strong style="color:#888;">${recipientEmail}</strong>.<br/>
            If you didn't expect this invitation, you can safely ignore this email.<br/>
            © ${year} ${appName}. All rights reserved.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = `You've been invited to ${appName}\n\n${inviterName ? `${inviterName} has invited you` : "You've been invited"} to join ${companyName}${roleName ? ` as ${roleName}` : ''}.\n\nAccept your invitation:\n${inviteUrl}\n\nThis invitation expires on ${expiry}.\n\nIf you didn't expect this, you can safely ignore this email.`;

  return { html, text };
}

function buildWelcomeEmail({ userName, companyName, loginUrl }) {
  const appName = process.env.APP_NAME || 'Redlines';
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Welcome to ${appName}!</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f0f;padding:40px 20px;">
  <tr><td align="center">
    <table width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#1a1a1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a2a;">
      <tr>
        <td style="background:linear-gradient(135deg,#1a1a1a 0%,#1f1a0e 100%);padding:40px;text-align:center;border-bottom:1px solid #2a2a2a;">
          <div style="display:inline-block;background:#c9a227;width:48px;height:48px;border-radius:12px;line-height:48px;text-align:center;font-size:22px;font-weight:900;color:#000;margin-bottom:16px;">R</div>
          <h1 style="margin:0;font-size:28px;font-weight:800;color:#fff;">Welcome to ${appName}!</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:40px;">
          <h2 style="margin:0 0 16px;color:#fff;">Hey ${userName || 'there'} 👋</h2>
          <p style="color:#9a9a9a;font-size:15px;line-height:1.7;margin:0 0 24px;">
            Welcome to <strong style="color:#c9a227;">${companyName}</strong>! Your account is ready and you can now collaborate on PDF documents, add markups, and work with your team.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${loginUrl || process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display:inline-block;background:#c9a227;color:#000;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px;">
              Open ${appName} →
            </a>
          </div>
        </td>
      </tr>
      <tr>
        <td style="background:#111;padding:24px 40px;border-top:1px solid #2a2a2a;text-align:center;">
          <p style="margin:0;color:#555;font-size:12px;">© ${year} ${appName}. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  return { html, text: `Welcome to ${appName}!\n\nHey ${userName || 'there'}, welcome to ${companyName}! Open ${appName}: ${loginUrl || process.env.FRONTEND_URL}` };
}

async function sendInvitationEmail({ to, inviteUrl, companyName, roleName, inviterName, expiresAt }) {
  const transport = await getTransporter();
  if (!transport) {
    console.log(`[Email] No SMTP configured — invitation link: ${inviteUrl}`);
    return false;
  }
  const { html, text } = buildInvitationEmail({ inviteUrl, companyName, roleName, inviterName, expiresAt, recipientEmail: to });
  const appName = process.env.APP_NAME || 'Redlines';
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transport.sendMail({
    from: `"${appName}" <${from}>`,
    to,
    subject: `You're invited to join ${companyName} on ${appName}`,
    html,
    text,
  });
  console.log(`[Email] Invitation sent to ${to}`);
  return true;
}

async function sendWelcomeEmail({ to, userName, companyName }) {
  const transport = await getTransporter();
  if (!transport) return false;
  const { html, text } = buildWelcomeEmail({ userName, companyName, loginUrl: process.env.FRONTEND_URL });
  const appName = process.env.APP_NAME || 'Redlines';
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transport.sendMail({
    from: `"${appName}" <${from}>`,
    to,
    subject: `Welcome to ${appName} — ${companyName}`,
    html,
    text,
  });
  console.log(`[Email] Welcome email sent to ${to}`);
  return true;
}

module.exports = { sendInvitationEmail, sendWelcomeEmail };
