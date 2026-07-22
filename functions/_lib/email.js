const DEFAULT_FROM = 'miracle <noreply@miracleapp.site>';

export async function sendAuthEmail(env, { to, subject, html, text }) {
  const from = parseAddress(env.EMAIL_FROM || DEFAULT_FROM);
  const payload = { to, subject, html, text };

  if (env.EMAIL?.send) {
    try {
      const result = await env.EMAIL.send({
        ...payload,
        from: { email: from.address, name: from.name },
      });
      return { ok: true, mode: 'cloudflare-email', id: result?.messageId || '' };
    } catch (err) {
      console.error('[email] Cloudflare Email send failed', err?.message || err);
      if (!hasRestProvider(env) && !env.RESEND_API_KEY) {
        return { ok: false, mode: 'cloudflare-email', error: err?.message || 'send failed' };
      }
    }
  }

  if (hasRestProvider(env)) {
    try {
      const accountId = env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID;
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          from: { address: from.address, name: from.name },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) {
        const error = data.errors?.[0]?.message || `cloudflare email ${response.status}`;
        console.error('[email] Cloudflare Email REST error', response.status, error);
        if (!env.RESEND_API_KEY) return { ok: false, mode: 'cloudflare-email-rest', error };
      } else {
        return { ok: true, mode: 'cloudflare-email-rest', id: data.result?.message_id || data.result?.messageId || '' };
      }
    } catch (err) {
      console.error('[email] Cloudflare Email REST failed', err?.message || err);
      if (!env.RESEND_API_KEY) return { ok: false, mode: 'cloudflare-email-rest', error: err?.message || 'send failed' };
    }
  }

  if (env.RESEND_API_KEY) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          from: formatAddress(from),
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        console.error('[email] Resend error', response.status, body.slice(0, 300));
        return { ok: false, mode: 'resend', error: `resend ${response.status}` };
      }
      const data = await response.json().catch(() => ({}));
      return { ok: true, mode: 'resend', id: data.id || '' };
    } catch (err) {
      console.error('[email] Resend send failed', err?.message || err);
      return { ok: false, mode: 'resend', error: err?.message || 'send failed' };
    }
  }

  console.error('[email] no provider configured: add CLOUDFLARE_EMAIL_API_TOKEN or RESEND_API_KEY');
  return { ok: false, mode: 'disabled', error: 'email provider not configured' };
}

function hasRestProvider(env) {
  return !!(env.CLOUDFLARE_EMAIL_API_TOKEN && (env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID));
}

export function verifyEmailTemplate({ appUrl, name, link }) {
  const greet = name ? `, ${name}` : '';
  const html = wrap({
    appUrl,
    preheader: 'Confirm your Miracle email so recovery works.',
    body: `
      <div class="mark">verify your email</div>
      <h1>welcome${escapeHtml(greet)}</h1>
      <p>Tap the button below to verify your email. This becomes your recovery channel for password resets and PIN recovery.</p>
      <p class="center"><a class="btn" href="${escapeAttr(link)}">verify email</a></p>
      <p class="small">Or paste this link:<br>${escapeHtml(link)}</p>
      <p class="small muted">This link expires in 24 hours. If you did not sign up for Miracle, ignore this email.</p>
    `,
  });
  const text = `Welcome${greet}.\n\nVerify your Miracle email:\n${link}\n\nThis link expires in 24 hours.\n${appUrl}`;
  return { subject: 'verify your Miracle email', html, text };
}

export function resetPasswordTemplate({ appUrl, name, link, ip }) {
  const greet = name ? `, ${name}` : '';
  const html = wrap({
    appUrl,
    preheader: 'A Miracle password reset was requested.',
    body: `
      <div class="mark">password reset</div>
      <h1>reset request${escapeHtml(greet)}</h1>
      <p>Tap below to set a new password. The link expires in 1 hour and can only be used once.</p>
      <p class="center"><a class="btn" href="${escapeAttr(link)}">set new password</a></p>
      <p class="small">Or paste this link:<br>${escapeHtml(link)}</p>
      <p class="small muted">Requested from IP ${escapeHtml(ip || 'unknown')}. If this was not you, ignore this email.</p>
    `,
  });
  const text = `Reset your Miracle password:\n${link}\n\nExpires in 1 hour. Requested from IP ${ip || 'unknown'}.\nIf this was not you, ignore this email.\n${appUrl}`;
  return { subject: 'reset your Miracle password', html, text };
}

export function pinResetOtpTemplate({ appUrl, name, otp, ip }) {
  const greet = name ? `, ${name}` : '';
  const html = wrap({
    appUrl,
    preheader: 'Your 6-digit Miracle PIN reset code.',
    body: `
      <div class="mark">vault PIN reset</div>
      <h1>your code${escapeHtml(greet)}</h1>
      <p>Enter this 6-digit code in the app to reset your vault PIN. It expires in 15 minutes.</p>
      <div class="otp">${escapeHtml(otp)}</div>
      <p class="small muted">Requested from IP ${escapeHtml(ip || 'unknown')}. If this was not you, someone may have access to your device.</p>
    `,
  });
  const text = `Your Miracle PIN reset code: ${otp}\n\nExpires in 15 minutes. Requested from IP ${ip || 'unknown'}.\n${appUrl}`;
  return { subject: 'your Miracle PIN reset code', html, text };
}

function wrap({ appUrl, preheader, body }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>Miracle</title>
  <style>
    body { margin:0; padding:32px 16px; background:#020403; color:#f7f1e5; font-family:Arial,sans-serif; }
    .card { max-width:560px; margin:0 auto; padding:34px 30px; border:1px solid rgba(25,197,143,.32); border-radius:14px; background:#07100c; }
    .preheader { display:none; max-height:0; overflow:hidden; opacity:0; }
    .mark { color:#d7a94d; letter-spacing:.18em; text-transform:uppercase; font:700 11px/1.4 monospace; }
    h1 { margin:10px 0 12px; color:#fffaf0; font:500 32px/1.08 Georgia,serif; }
    p { color:#d8d6ce; line-height:1.58; }
    a { color:#19c58f; }
    .center { text-align:center; margin:26px 0; }
    .btn { display:inline-block; padding:13px 22px; border-radius:10px; color:#020403 !important; background:#19c58f; font-weight:700; text-decoration:none; }
    .small { font-size:12px; }
    .muted { color:rgba(247,241,229,.58); }
    .otp { margin:22px 0; padding:18px; text-align:center; border:1px solid rgba(215,169,77,.42); border-radius:12px; color:#fffaf0; background:rgba(25,197,143,.08); font:700 38px/1.1 monospace; letter-spacing:12px; }
    .footer { margin-top:26px; padding-top:18px; border-top:1px solid rgba(255,255,255,.08); color:rgba(247,241,229,.52); font-size:12px; }
  </style>
</head>
<body>
  <div class="preheader">${escapeHtml(preheader || '')}</div>
  <div class="card">
    ${body}
    <div class="footer">Miracle personal life system - <a href="${escapeAttr(appUrl)}">${escapeHtml(appUrl)}</a></div>
  </div>
</body>
</html>`;
}

function parseAddress(value) {
  const raw = String(value || DEFAULT_FROM).trim();
  const match = raw.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) return { name: match[1].replace(/^"|"$/g, '').trim() || 'Miracle', address: match[2].trim() };
  return { name: 'Miracle', address: raw };
}

function formatAddress({ name, address }) {
  return name ? `${name} <${address}>` : address;
}

function escapeHtml(value) {
  return String(value || '').replace(/[<>&"]/g, char => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#39;');
}
