// email.js — outbound transactional email.
//
// Three modes, picked at startup:
//   1. RESEND_API_KEY set         → Resend HTTPS API (zero deps, one fetch)
//   2. SMTP_HOST + SMTP_USER set  → not implemented yet (placeholder for nodemailer)
//   3. otherwise                  → console.log (dev mode — read backend logs)
//
// Env vars:
//   RESEND_API_KEY   — get from resend.com (free tier: 100/day)
//   EMAIL_FROM       — defaults to "miracle <onboarding@resend.dev>"
//                      change to "miracle <noreply@miracleapp.site>" once your domain is verified
//   APP_URL          — defaults to https://miracleapp.site

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const FROM       = process.env.EMAIL_FROM     || 'miracle <onboarding@resend.dev>';
export const APP_URL = process.env.APP_URL    || 'https://miracleapp.site';

export const EMAIL_MODE =
  RESEND_KEY ? 'resend' : 'console';

if (!RESEND_KEY) {
  console.warn('[email] RESEND_API_KEY not set — emails will be logged to stdout only.');
} else {
  console.log(`[email] mode=resend  from="${FROM}"  app=${APP_URL}`);
}

/** Send transactional email. Returns { ok, mode, id?, error? }. */
export async function sendEmail({ to, subject, html, text }) {
  if (EMAIL_MODE === 'console') {
    console.log(
      '\n══════════════════════════════════════════════════════' +
      `\n[email:console]  to: ${to}` +
      `\n[email:console]  subject: ${subject}` +
      `\n[email:console]  ${text || stripHtml(html)}` +
      '\n══════════════════════════════════════════════════════\n',
    );
    return { ok: true, mode: 'console' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html, text }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('[email] resend error', res.status, body.slice(0, 300));
      return { ok: false, mode: 'resend', error: `resend ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, mode: 'resend', id: data.id };
  } catch (e) {
    console.error('[email] send failed', e);
    return { ok: false, mode: 'resend', error: e.message };
  }
}

function stripHtml(s) { return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }

// ══════════════════════════════════════════════════════════════
// EMAIL TEMPLATES — same minimalist tone as the app itself
// ══════════════════════════════════════════════════════════════

function wrap({ preheader, body, footer }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>miracle</title>
<style>
  body { margin:0; padding:32px 16px; background:#0A0A0C; font-family:'Inter',Helvetica,Arial,sans-serif; color:#F5F4F0; -webkit-font-smoothing:antialiased; }
  .card { max-width:520px; margin:0 auto; background:#0F1419; border:1px solid rgba(16,185,129,0.18); border-radius:18px; padding:36px 32px; }
  h1 { font-family:'Cormorant Garamond',Georgia,serif; font-weight:500; font-size:32px; margin:0 0 8px; letter-spacing:-1px; }
  .mark { color:#10B981; letter-spacing:3px; font-size:11px; text-transform:uppercase; font-family:monospace; }
  p { line-height:1.55; color:#D8D6CE; }
  .otp { font-family:'JetBrains Mono',monospace; font-size:36px; letter-spacing:14px; text-align:center; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.30); padding:18px; border-radius:12px; margin:18px 0; color:#F5F4F0; }
  .btn { display:inline-block; background:#10B981; color:#0A0A0C !important; text-decoration:none; padding:12px 22px; border-radius:10px; font-weight:600; }
  .meta { color:rgba(245,244,240,0.50); font-size:12px; margin-top:24px; padding-top:18px; border-top:1px solid rgba(255,255,255,0.06); }
  a { color:#10B981; }
  .preheader { display:none; max-height:0; overflow:hidden; }
</style></head><body>
<div class="preheader">${esc(preheader || '')}</div>
<div class="card">
  ${body}
  <div class="meta">${footer || 'miracle · personal cognitive system · <a href="' + APP_URL + '">miracleapp.site</a>'}</div>
</div>
</body></html>`;
}

function esc(s) { return String(s || '').replace(/[<>&]/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;' }[c])); }

// ── Verify email ──────────────────────────────────────────────
export function verifyEmailTemplate({ name, link }) {
  const greet = name ? `, ${name}` : '';
  const html = wrap({
    preheader: 'confirm your email so you can recover access if you forget your password or PIN.',
    body: `
      <div class="mark">◆ verify your email</div>
      <h1>welcome${greet}</h1>
      <p>tap the button below to verify your email. this becomes your recovery channel for password resets and PIN recovery — only verified emails can recover.</p>
      <p style="text-align:center; margin:24px 0;"><a class="btn" href="${esc(link)}">verify email</a></p>
      <p style="font-size:12px; color:rgba(245,244,240,0.55)">or paste this link:<br>${esc(link)}</p>
      <p style="font-size:12px; color:rgba(245,244,240,0.45)">this link expires in 24 hours. if you didn't sign up for miracle, ignore this email.</p>
    `,
  });
  const text = `welcome${greet}.\n\nverify your email so you can recover your account later:\n${link}\n\nexpires in 24 hours.\nmiracle · ${APP_URL}`;
  return { subject: 'verify your miracle email', html, text };
}

// ── Reset password ────────────────────────────────────────────
export function resetPasswordTemplate({ name, link, ip }) {
  const greet = name ? `, ${name}` : '';
  const html = wrap({
    preheader: 'a password reset was requested for your miracle account.',
    body: `
      <div class="mark">◆ password reset</div>
      <h1>reset request${greet}</h1>
      <p>tap below to set a new password. the link expires in 1 hour and can only be used once.</p>
      <p style="text-align:center; margin:24px 0;"><a class="btn" href="${esc(link)}">set new password</a></p>
      <p style="font-size:12px; color:rgba(245,244,240,0.55)">or paste this link:<br>${esc(link)}</p>
      <p style="font-size:12px; color:rgba(245,244,240,0.45)">requested from IP ${esc(ip || 'unknown')}. if you didn't request this, ignore this email — your password stays the same.</p>
    `,
  });
  const text = `reset your miracle password:\n${link}\n\nexpires in 1 hour. requested from IP ${ip || 'unknown'}.\nignore this if you didn't request it.\nmiracle · ${APP_URL}`;
  return { subject: 'reset your miracle password', html, text };
}

// ── PIN reset OTP ─────────────────────────────────────────────
export function pinResetOtpTemplate({ name, otp, ip }) {
  const greet = name ? `, ${name}` : '';
  const html = wrap({
    preheader: 'your 6-digit code to reset your vault PIN.',
    body: `
      <div class="mark">◆ vault PIN reset</div>
      <h1>your code${greet}</h1>
      <p>enter this 6-digit code in the app to reset your vault PIN. expires in 15 minutes.</p>
      <div class="otp">${esc(otp)}</div>
      <p style="font-size:12px; color:rgba(245,244,240,0.55)">resetting your PIN unlocks every entry you previously locked — your data is not deleted. set a new PIN after.</p>
      <p style="font-size:12px; color:rgba(245,244,240,0.45)">requested from IP ${esc(ip || 'unknown')}. if you didn't request this, someone may have access to your device.</p>
    `,
  });
  const text = `your miracle PIN reset code: ${otp}\n\nexpires in 15 minutes.\nrequested from IP ${ip || 'unknown'}.\nmiracle · ${APP_URL}`;
  return { subject: `miracle PIN reset · code ${otp}`, html, text };
}
