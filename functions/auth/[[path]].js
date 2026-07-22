import {
  appUrl,
  clientIp,
  emailOk,
  getAuthedUser,
  hashPassword,
  issueSession,
  json,
  methodNotAllowed,
  passwordOk,
  pathParts,
  publicUser,
  randomHex,
  readJson,
  requireUser,
  tokenFromRequest,
  ulid,
  verifyPassword,
} from '../_lib/common.js';
import {
  pinResetOtpTemplate,
  resetPasswordTemplate,
  sendAuthEmail,
  verifyEmailTemplate,
} from '../_lib/email.js';

const VERIFY_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;
const OTP_TTL_MINUTES = 15;
const OTP_MAX_ATTEMPTS = 5;

export async function onRequest(context) {
  try {
    const method = context.request.method.toUpperCase();
    const [route] = pathParts(context.params.path);

    if (method === 'OPTIONS') return new Response(null, { status: 204 });
    if (method === 'POST' && route === 'signup') return signup(context);
    if (method === 'POST' && route === 'login') return login(context);
    if (method === 'POST' && route === 'logout') return logout(context);
    if (method === 'GET' && route === 'me') return me(context);
    if (method === 'POST' && route === 'send-verification') return sendVerification(context);
    if (method === 'GET' && route === 'verify-email') return verifyEmail(context);
    if (method === 'POST' && route === 'forgot-password') return forgotPassword(context);
    if (method === 'POST' && route === 'reset-password') return resetPassword(context);
    if (method === 'POST' && route === 'forgot-pin') return forgotPin(context);
    if (method === 'POST' && route === 'verify-pin-otp') return verifyPinOtp(context);
    return methodNotAllowed();
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[auth]', err);
    return json({ error: 'auth failed' }, { status: 500 });
  }
}

async function signup({ request, env }) {
  const body = await readJson(request);
  const {
    email,
    password,
    name = '',
    calling = '',
    anchorVerse = '',
    dayStart = '06:00',
    timezone = 'Africa/Accra',
  } = body || {};

  if (!emailOk(email)) return json({ error: 'invalid email' }, { status: 400 });
  if (!passwordOk(password)) return json({ error: 'password must be at least 8 characters' }, { status: 400 });

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(normalizedEmail).first();
  if (existing) return json({ error: 'email already registered' }, { status: 409 });

  const id = ulid();
  const passwordHash = await hashPassword(password);
  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, name, calling, anchor_verse, day_start, timezone)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    normalizedEmail,
    passwordHash,
    String(name).slice(0, 120),
    String(calling).slice(0, 2000),
    String(anchorVerse).slice(0, 80),
    String(dayStart || '06:00').slice(0, 5),
    String(timezone || 'Africa/Accra').slice(0, 64),
  ).run();

  const token = await issueSession(env, id, request);
  const emailResult = await sendVerificationEmail(env, request, id, normalizedEmail, name);
  return json({
    token,
    user: await publicUser(env, id),
    emailSent: emailResult.ok,
    emailMode: emailResult.mode,
  });
}

async function login({ request, env }) {
  const body = await readJson(request);
  const { email, password } = body || {};
  if (!emailOk(email) || !password) return json({ error: 'invalid credentials' }, { status: 400 });

  const user = await env.DB.prepare(
    'SELECT id, password_hash AS passwordHash FROM users WHERE email = ?',
  ).bind(email.trim().toLowerCase()).first();
  if (!user) return json({ error: 'invalid email or password' }, { status: 401 });

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return json({ error: 'invalid email or password' }, { status: 401 });

  await env.DB.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id).run();
  const token = await issueSession(env, user.id, request);
  return json({ token, user: await publicUser(env, user.id) });
}

async function logout({ request, env }) {
  const token = tokenFromRequest(request);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return json({ ok: true });
}

async function me({ request, env }) {
  const user = await getAuthedUser(env, request);
  if (!user) return json({ error: 'not authenticated' }, { status: 401 });
  return json({ user: await publicUser(env, user.id) });
}

async function sendVerification({ request, env }) {
  const authed = await requireUser(env, request);
  const user = await env.DB.prepare(
    'SELECT id, email, name, email_verified AS emailVerified FROM users WHERE id = ?',
  ).bind(authed.id).first();
  if (!user) return json({ error: 'user not found' }, { status: 404 });
  if (user.emailVerified) return json({ ok: true, alreadyVerified: true });
  const result = await sendVerificationEmail(env, request, user.id, user.email, user.name);
  return jsonFromEmailResult(result, 'could not send verification email');
}

async function verifyEmail({ request, env }) {
  const origin = appUrl(request, env);
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return Response.redirect(`${origin}/#/auth/verified?ok=0&reason=bad-token`, 302);
  }

  const row = await env.DB.prepare(
    'SELECT user_id AS userId, expires_at AS expiresAt, used_at AS usedAt FROM email_verifications WHERE token = ?',
  ).bind(token).first();
  if (!row) return Response.redirect(`${origin}/#/auth/verified?ok=0&reason=not-found`, 302);
  if (row.usedAt) return Response.redirect(`${origin}/#/auth/verified?ok=0&reason=used`, 302);
  if (isExpired(row.expiresAt)) return Response.redirect(`${origin}/#/auth/verified?ok=0&reason=expired`, 302);

  await env.DB.prepare(
    'UPDATE users SET email_verified = 1, email_verified_at = CURRENT_TIMESTAMP WHERE id = ?',
  ).bind(row.userId).run();
  await env.DB.prepare(
    'UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE token = ?',
  ).bind(token).run();
  return Response.redirect(`${origin}/#/auth/verified?ok=1`, 302);
}

async function forgotPassword({ request, env }) {
  const body = await readJson(request);
  const email = body?.email;
  if (!emailOk(email)) return json({ ok: true });

  const normalizedEmail = email.trim().toLowerCase();
  const user = await env.DB.prepare(
    'SELECT id, name, email_verified AS emailVerified FROM users WHERE email = ?',
  ).bind(normalizedEmail).first();

  if (user?.emailVerified) {
    const token = randomHex(32);
    const expiresAt = expiresInHours(RESET_TTL_HOURS);
    await env.DB.prepare(
      'INSERT INTO password_resets (token, user_id, expires_at, ip) VALUES (?, ?, ?, ?)',
    ).bind(token, user.id, expiresAt, clientIp(request)).run();
    const origin = appUrl(request, env);
    const template = resetPasswordTemplate({
      appUrl: origin,
      name: user.name,
      link: `${origin}/#/auth/reset/${token}`,
      ip: clientIp(request),
    });
    const result = await sendAuthEmail(env, { to: normalizedEmail, ...template });
    if (!result.ok) console.error('[auth] password reset email failed', result.mode, result.error);
  }

  return json({ ok: true, mode: user?.emailVerified ? 'sent-if-configured' : 'hidden' });
}

async function resetPassword({ request, env }) {
  const body = await readJson(request);
  const { token, password } = body || {};
  if (!/^[a-f0-9]{64}$/i.test(token || '')) return json({ error: 'invalid token' }, { status: 400 });
  if (!passwordOk(password)) return json({ error: 'password must be at least 8 characters' }, { status: 400 });

  const row = await env.DB.prepare(
    'SELECT user_id AS userId, expires_at AS expiresAt, used_at AS usedAt FROM password_resets WHERE token = ?',
  ).bind(token).first();
  if (!row) return json({ error: 'invalid or unknown reset link' }, { status: 400 });
  if (row.usedAt) return json({ error: 'this reset link was already used' }, { status: 400 });
  if (isExpired(row.expiresAt)) return json({ error: 'reset link expired - request a new one' }, { status: 400 });

  const passwordHash = await hashPassword(password);
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, row.userId).run();
  await env.DB.prepare('UPDATE password_resets SET used_at = CURRENT_TIMESTAMP WHERE token = ?').bind(token).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.userId).run();
  return json({ ok: true });
}

async function forgotPin({ request, env }) {
  const authed = await requireUser(env, request);
  const user = await env.DB.prepare(
    'SELECT id, email, name, email_verified AS emailVerified FROM users WHERE id = ?',
  ).bind(authed.id).first();
  if (!user) return json({ error: 'user not found' }, { status: 404 });
  if (!user.emailVerified) {
    return json({
      error: 'email not verified - verify your email first to enable PIN recovery',
      needsVerification: true,
    }, { status: 403 });
  }

  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM pin_resets WHERE user_id = ? AND created_at > datetime('now', '-15 minutes')",
  ).bind(user.id).first();
  if ((recent?.n || 0) >= 3) {
    return json({ error: 'too many requests - wait 15 minutes and try again' }, { status: 429 });
  }

  const otp = makeOtp();
  const otpHash = await sha256Hex(otp);
  const id = ulid();
  await env.DB.prepare(
    'INSERT INTO pin_resets (id, user_id, otp_hash, expires_at, ip) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, user.id, otpHash, expiresInMinutes(OTP_TTL_MINUTES), clientIp(request)).run();

  const origin = appUrl(request, env);
  const template = pinResetOtpTemplate({
    appUrl: origin,
    name: user.name,
    otp,
    ip: clientIp(request),
  });
  const result = await sendAuthEmail(env, { to: user.email, ...template });
  const response = jsonFromEmailResult(result, 'could not send PIN reset code', {
    sentTo: maskEmail(user.email),
    expiresInMinutes: OTP_TTL_MINUTES,
  });
  if (!result.ok) {
    await env.DB.prepare('UPDATE pin_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?').bind(id).run();
  }
  return response;
}

async function verifyPinOtp({ request, env }) {
  const authed = await requireUser(env, request);
  const body = await readJson(request);
  const otp = String(body?.otp || '');
  if (!/^\d{6}$/.test(otp)) return json({ error: 'enter the 6-digit code' }, { status: 400 });

  const row = await env.DB.prepare(
    `SELECT id, otp_hash AS otpHash, attempts, used_at AS usedAt, expires_at AS expiresAt
       FROM pin_resets
      WHERE user_id = ? AND used_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
  ).bind(authed.id).first();
  if (!row || isExpired(row.expiresAt)) return json({ error: 'no active code - request a new one' }, { status: 400 });
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    return json({ error: 'too many wrong attempts - request a new code' }, { status: 429 });
  }

  const otpHash = await sha256Hex(otp);
  if (!constantTimeEqual(otpHash, row.otpHash)) {
    await env.DB.prepare('UPDATE pin_resets SET attempts = attempts + 1 WHERE id = ?').bind(row.id).run();
    return json({ error: 'wrong code', attemptsLeft: OTP_MAX_ATTEMPTS - row.attempts - 1 }, { status: 400 });
  }

  await env.DB.prepare('UPDATE pin_resets SET used_at = CURRENT_TIMESTAMP WHERE id = ?').bind(row.id).run();
  return json({ ok: true });
}

async function sendVerificationEmail(env, request, userId, email, name) {
  const token = randomHex(32);
  await env.DB.prepare(
    'INSERT INTO email_verifications (token, user_id, expires_at) VALUES (?, ?, ?)',
  ).bind(token, userId, expiresInHours(VERIFY_TTL_HOURS)).run();
  const origin = appUrl(request, env);
  const template = verifyEmailTemplate({
    appUrl: origin,
    name,
    link: `${origin}/auth/verify-email?token=${token}`,
  });
  const result = await sendAuthEmail(env, { to: email, ...template });
  if (!result.ok) {
    await env.DB.prepare('UPDATE email_verifications SET used_at = CURRENT_TIMESTAMP WHERE token = ?').bind(token).run();
    console.error('[auth] verification email failed', result.mode, result.error);
  }
  return result;
}

function jsonFromEmailResult(result, message, extra = {}) {
  if (result.ok) return json({ ok: true, mode: result.mode, ...extra });
  return json({
    ok: false,
    mode: result.mode,
    error: message,
    detail: result.error,
    ...extra,
  }, { status: 503 });
}

function expiresInHours(hours) {
  return new Date(Date.now() + hours * 3600_000).toISOString();
}

function expiresInMinutes(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function isExpired(value) {
  return new Date(value).getTime() <= Date.now();
}

function makeOtp() {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1_000_000).padStart(6, '0');
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let diff = a.length === b.length ? 0 : 1;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

function maskEmail(email) {
  const [local, domain] = String(email || '').split('@');
  if (!local || !domain) return email;
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}
