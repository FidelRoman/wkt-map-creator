import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL ?? 'WKT Studio <hello@wktstudio.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wktstudio.com';

// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(content: string) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WKT Studio</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
      <tr><td style="padding:32px 40px 0;">
        <!-- Logo -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:32px;">
          <span style="font-size:20px;font-weight:800;color:#1e293b;letter-spacing:-0.5px;">WKT Studio</span>
          <span style="background:#ede9fe;color:#7c3aed;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase;">GIS</span>
        </div>
        ${content}
      </td></tr>
      <tr><td style="padding:24px 40px 32px;border-top:1px solid #f1f5f9;margin-top:40px;">
        <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
          You're receiving this because you have a WKT Studio account.<br>
          <a href="${APP_URL}" style="color:#6366f1;text-decoration:none;">${APP_URL.replace('https://', '')}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function button(href: string, text: string) {
  return `<a href="${href}" style="display:inline-block;background:#6366f1;color:#ffffff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:-0.1px;margin-top:8px;">${text}</a>`;
}

function h1(text: string) {
  return `<h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0f172a;letter-spacing:-0.5px;line-height:1.2;">${text}</h1>`;
}

function p(text: string) {
  return `<p style="margin:0 0 20px;font-size:16px;color:#475569;line-height:1.65;">${text}</p>`;
}

// ─── Email: Welcome ───────────────────────────────────────────────────────────

export async function sendWelcomeEmail(email: string, name: string) {
  if (!resend) return;
  const firstName = name?.split(' ')[0] || 'there';
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Welcome to WKT Studio 🗺️',
    html: layout(`
      ${h1(`Welcome, ${firstName}!`)}
      ${p('You just unlocked a full GIS map editor in your browser — no installs, no setup. Here\'s what you can do:')}
      <ul style="margin:0 0 24px;padding:0 0 0 20px;color:#475569;font-size:15px;line-height:2;">
        <li>Paste WKT from PostGIS or Shapely and see it on a map</li>
        <li>Import GeoJSON, CSV or Shapefiles into layers</li>
        <li>Share your map with a public link or embed it on your site</li>
        <li>Use the REST API to read/write features programmatically</li>
      </ul>
      ${button(`${APP_URL}/wkt-viewer`, 'Open the Editor →')}
      <p style="margin:24px 0 32px;font-size:14px;color:#94a3b8;">Questions? Just reply to this email.</p>
    `),
  });
}

// ─── Email: Upgrade confirmed ─────────────────────────────────────────────────

export async function sendUpgradeEmail(email: string, name: string, periodEnd?: string | null) {
  if (!resend) return;
  const firstName = name?.split(' ')[0] || 'there';
  const renewal = periodEnd ? new Date(periodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'You\'re now on WKT Studio Pro ✨',
    html: layout(`
      ${h1(`You're on Pro, ${firstName}!`)}
      ${p('Your upgrade is confirmed. Here\'s what\'s now unlocked for you:')}
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;">
        ${[
          ['Unlimited projects & features', '5,000 features per layer'],
          ['20 layers per project', '10 collaborators per project'],
          ['REST API (1,000 calls/month)', 'KML export'],
          ['Version history', 'Spatial analysis & Buffer'],
          ['Embed maps on your website', ''],
        ].map(([a, b]) => `<tr>
          <td style="padding:6px 0;font-size:14px;color:#1e293b;width:50%;">✅ ${a}</td>
          ${b ? `<td style="padding:6px 0;font-size:14px;color:#1e293b;">✅ ${b}</td>` : '<td></td>'}
        </tr>`).join('')}
      </table>
      ${renewal ? p(`<strong>Next renewal:</strong> ${renewal}`) : ''}
      ${button(`${APP_URL}`, 'Go to Dashboard →')}
      <p style="margin:24px 0 32px;font-size:14px;color:#94a3b8;">Manage your subscription anytime from Settings → Billing.</p>
    `),
  });
}

// ─── Email: 80% usage warning ─────────────────────────────────────────────────

export async function sendUsageWarningEmail(email: string, name: string, projectName: string, count: number, max: number) {
  if (!resend) return;
  const firstName = name?.split(' ')[0] || 'there';
  const pct = Math.round((count / max) * 100);
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Heads up — you've used ${pct}% of your layer limit`,
    html: layout(`
      ${h1(`You're at ${pct}% of your limit`)}
      ${p(`Your layer in <strong>${projectName}</strong> has <strong>${count} of ${max}</strong> features used. On the free plan, layers are limited to ${max} features.`)}
      ${p('Upgrade to Pro for unlimited features per layer, plus 20 layers per project and much more.')}
      ${button(`${APP_URL}/pricing`, 'Upgrade to Pro →')}
      <p style="margin:24px 0 32px;font-size:14px;color:#94a3b8;">You can also delete some features to free up space.</p>
    `),
  });
}

// ─── Email: Collaborator invite ───────────────────────────────────────────────

export async function sendCollaboratorInviteEmail(
  inviteeEmail: string,
  inviterName: string,
  projectName: string,
  projectUrl: string,
  role: 'editor' | 'viewer',
) {
  if (!resend) return;
  const roleLabel = role === 'editor' ? 'edit' : 'view';
  await resend.emails.send({
    from: FROM,
    to: inviteeEmail,
    subject: `${inviterName} invited you to a map on WKT Studio`,
    html: layout(`
      ${h1('You\'ve been invited to a map')}
      ${p(`<strong>${inviterName}</strong> invited you to <strong>${roleLabel}</strong> the project <strong>"${projectName}"</strong> on WKT Studio.`)}
      ${p('WKT Studio is a GIS map editor for developers. You can view geographic features, paste WKT geometry, import GeoJSON files, and collaborate with your team.')}
      ${button(projectUrl, 'Open Map →')}
      <p style="margin:24px 0 32px;font-size:14px;color:#94a3b8;">You'll need a free WKT Studio account to ${roleLabel} this project.</p>
    `),
  });
}
