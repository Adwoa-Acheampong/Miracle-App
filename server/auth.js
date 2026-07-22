// Auth routes — signup / login / logout / me — session-token based.
// Email verification + password reset + PIN OTP reset live here too.

import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { query, one } from './db.js';
import { ulid } from './ulid.js';
import {
  sendEmail, verifyEmailTemplate, resetPasswordTemplate, pinResetOtpTemplate, APP_URL,
} from './email.js';

export const auth = express.Router();

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);
const VERIFY_TTL_HOURS = 24;
const RESET_TTL_HOURS  = 1;
const OTP_TTL_MIN      = 15;
const OTP_MAX_ATTEMPTS = 5;

function makeToken() { return crypto.randomBytes(32).toString('hex'); }
function makeOtp()   { return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0'); }
function sha256(s)   { return crypto.createHash('sha256').update(s).digest('hex'); }

function emailOk(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

function passwordOk(s) {
  return typeof s === 'string' && s.length >= 8 && s.length <= 200;
}

function clientIp(req) {
  return (req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip || '').slice(0, 45);
}

// POST /auth/signup  { email, password, name?, calling? }
auth.post('/signup', async (req, res) => {
  try {
    const { email, password, name = '', calling = '', anchorVerse = '', dayStart = '06:00', timezone = 'Africa/Accra' } = req.body || {};
    if (!emailOk(email))      return res.status(400).json({ error: 'invalid email' });
    if (!passwordOk(password)) return res.status(400).json({ error: 'password must be at least 8 characters' });

    const existing = await one('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'email already registered' });

    const id = ulid();
    const hash = await bcrypt.hash(password, 12);
    await query(
      `INSERT INTO users (id, email, password_hash, name, calling, anchor_verse, day_start, timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, email.trim().toLowerCase(), hash, String(name).slice(0, 120), String(calling).slice(0, 2000), String(anchorVerse).slice(0, 80), dayStart, timezone],
    );

    const token = await issueSession(id, req);

    // Fire-and-forget verification email — don't block signup if it fails
    sendVerificationEmail(id, email.trim().toLowerCase(), name).catch(e => {
      console.warn('[signup] failed to send verification email:', e.message);
    });

    res.json({ token, user: await publicUser(id) });
  } catch (e) {
    console.error('signup', e);
    res.status(500).json({ error: 'signup failed' });
  }
});

// POST /auth/login  { email, password }
auth.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!emailOk(email) || !password) return res.status(400).json({ error: 'invalid credentials' });

    const u = await one('SELECT id, password_hash FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!u) return res.status(401).json({ error: 'invalid email or password' });

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid email or password' });

    await query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [u.id]);
    const token = await issueSession(u.id, req);
    res.json({ token, user: await publicUser(u.id) });
  } catch (e) {
    console.error('login', e);
    res.status(500).json({ error: 'login failed' });
  }
});

// POST /auth/logout — invalidate this session
auth.post('/logout', async (req, res) => {
  const token = req.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (token) await query('DELETE FROM sessions WHERE token = ?', [token]);
  res.json({ ok: true });
});

// GET /auth/me — return current user
auth.get('/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'not authenticated' });
  res.json({ user: await publicUser(req.user.id) });
});

// ══════════════════════════════════════════════════════════════
// EMAIL VERIFICATION
// ══════════════════════════════════════════════════════════════

// POST /auth/send-verification — re-send the verification email for current user
auth.post('/send-verification', requireAuth, async (req, res) => {
  try {
    const u = await one('SELECT id, email, name, email_verified FROM users WHERE id = ?', [req.user.id]);
    if (!u) return res.status(404).json({ error: 'user not found' });
    if (u.email_verified) return res.json({ ok: true, alreadyVerified: true });
    const r = await sendVerificationEmail(u.id, u.email, u.name);
    res.json({ ok: r.ok, mode: r.mode });
  } catch (e) {
    console.error('send-verification', e);
    res.status(500).json({ error: 'could not send verification' });
  }
});

// GET /auth/verify-email?token=xxx — consume token, mark email_verified
auth.get('/verify-email', async (req, res) => {
  const token = String(req.query.token || '');
  if (!token || token.length !== 64) return res.redirect(`${APP_URL}/#/auth/verified?ok=0&reason=bad-token`);
  try {
    const row = await one(
      `SELECT user_id, expires_at, used_at FROM email_verifications WHERE token = ?`,
      [token],
    );
    if (!row)                       return res.redirect(`${APP_URL}/#/auth/verified?ok=0&reason=not-found`);
    if (row.used_at)                return res.redirect(`${APP_URL}/#/auth/verified?ok=0&reason=used`);
    if (new Date(row.expires_at) < new Date()) return res.redirect(`${APP_URL}/#/auth/verified?ok=0&reason=expired`);

    await query(
      `UPDATE users SET email_verified = 1, email_verified_at = NOW() WHERE id = ?`,
      [row.user_id],
    );
    await query(`UPDATE email_verifications SET used_at = NOW() WHERE token = ?`, [token]);
    res.redirect(`${APP_URL}/#/auth/verified?ok=1`);
  } catch (e) {
    console.error('verify-email', e);
    res.redirect(`${APP_URL}/#/auth/verified?ok=0&reason=server-error`);
  }
});

// ══════════════════════════════════════════════════════════════
// PASSWORD RESET
// ══════════════════════════════════════════════════════════════

// POST /auth/forgot-password { email }
// Always returns { ok: true } regardless of whether the email exists (anti-enumeration).
auth.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!emailOk(email)) return res.json({ ok: true });  // silent no-op on bad input

    const u = await one(
      `SELECT id, name, email_verified FROM users WHERE email = ?`,
      [email.trim().toLowerCase()],
    );

    // Only send reset link if user exists AND email is verified.
    // Unverified users have no proven recovery channel — by design.
    if (u && u.email_verified) {
      const token = makeToken();
      const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 3600_000);
      await query(
        `INSERT INTO password_resets (token, user_id, expires_at, ip) VALUES (?, ?, ?, ?)`,
        [token, u.id, expiresAt, clientIp(req)],
      );
      const link = `${APP_URL}/#/auth/reset/${token}`;
      const tmpl = resetPasswordTemplate({ name: u.name, link, ip: clientIp(req) });
      await sendEmail({ to: email.trim().toLowerCase(), ...tmpl });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('forgot-password', e);
    res.json({ ok: true });  // never leak server errors here
  }
});

// POST /auth/reset-password { token, password }
auth.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || token.length !== 64) return res.status(400).json({ error: 'invalid token' });
    if (!passwordOk(password))         return res.status(400).json({ error: 'password must be at least 8 characters' });

    const row = await one(
      `SELECT user_id, expires_at, used_at FROM password_resets WHERE token = ?`,
      [token],
    );
    if (!row)                                   return res.status(400).json({ error: 'invalid or unknown reset link' });
    if (row.used_at)                            return res.status(400).json({ error: 'this reset link was already used' });
    if (new Date(row.expires_at) < new Date())  return res.status(400).json({ error: 'reset link expired — request a new one' });

    const hash = await bcrypt.hash(password, 12);
    await query(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, row.user_id]);
    await query(`UPDATE password_resets SET used_at = NOW() WHERE token = ?`, [token]);

    // Invalidate all existing sessions — force re-login everywhere
    await query(`DELETE FROM sessions WHERE user_id = ?`, [row.user_id]);

    res.json({ ok: true });
  } catch (e) {
    console.error('reset-password', e);
    res.status(500).json({ error: 'reset failed' });
  }
});

// ══════════════════════════════════════════════════════════════
// PIN RESET (vault unlock recovery)
// ══════════════════════════════════════════════════════════════

// POST /auth/forgot-pin — emails a 6-digit OTP to the (verified) user's email
auth.post('/forgot-pin', requireAuth, async (req, res) => {
  try {
    const u = await one(
      `SELECT id, email, name, email_verified FROM users WHERE id = ?`,
      [req.user.id],
    );
    if (!u) return res.status(404).json({ error: 'user not found' });
    if (!u.email_verified) {
      return res.status(403).json({
        error: 'email not verified — verify your email first to enable PIN recovery',
        needsVerification: true,
      });
    }

    // Rate limit: max 3 OTPs in the last 15 minutes
    const recent = await one(
      `SELECT COUNT(*) AS n FROM pin_resets WHERE user_id = ? AND created_at > (NOW() - INTERVAL 15 MINUTE)`,
      [u.id],
    );
    if (recent && recent.n >= 3) {
      return res.status(429).json({ error: 'too many requests — wait 15 minutes and try again' });
    }

    const otp = makeOtp();
    const otpHash = sha256(otp);
    const id = ulid();
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);
    await query(
      `INSERT INTO pin_resets (id, user_id, otp_hash, expires_at, ip) VALUES (?, ?, ?, ?, ?)`,
      [id, u.id, otpHash, expiresAt, clientIp(req)],
    );

    const tmpl = pinResetOtpTemplate({ name: u.name, otp, ip: clientIp(req) });
    const r = await sendEmail({ to: u.email, ...tmpl });
    res.json({ ok: r.ok, sentTo: maskEmail(u.email), expiresInMinutes: OTP_TTL_MIN });
  } catch (e) {
    console.error('forgot-pin', e);
    res.status(500).json({ error: 'could not send code' });
  }
});

// POST /auth/verify-pin-otp { otp }
// On success the server marks the OTP used. The client is then authorised
// to call its local forgotPin() (which wipes the PIN + clears locked flags).
auth.post('/verify-pin-otp', requireAuth, async (req, res) => {
  try {
    const { otp } = req.body || {};
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'enter the 6-digit code' });
    }
    const otpHash = sha256(otp);

    // Look up the most recent unused, unexpired OTP for this user
    const row = await one(
      `SELECT id, otp_hash, attempts, used_at, expires_at
       FROM pin_resets
       WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [req.user.id],
    );
    if (!row) return res.status(400).json({ error: 'no active code — request a new one' });

    if (row.attempts >= OTP_MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'too many wrong attempts — request a new code' });
    }

    // Hash-compare in constant time
    const match = crypto.timingSafeEqual(Buffer.from(row.otp_hash, 'hex'), Buffer.from(otpHash, 'hex'));
    if (!match) {
      await query(`UPDATE pin_resets SET attempts = attempts + 1 WHERE id = ?`, [row.id]);
      return res.status(400).json({ error: 'wrong code', attemptsLeft: OTP_MAX_ATTEMPTS - row.attempts - 1 });
    }

    await query(`UPDATE pin_resets SET used_at = NOW() WHERE id = ?`, [row.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('verify-pin-otp', e);
    res.status(500).json({ error: 'verify failed' });
  }
});

// Helpers ----------------------------------------------------

async function sendVerificationEmail(userId, email, name) {
  const token = makeToken();
  const expiresAt = new Date(Date.now() + VERIFY_TTL_HOURS * 3600_000);
  await query(
    `INSERT INTO email_verifications (token, user_id, expires_at) VALUES (?, ?, ?)`,
    [token, userId, expiresAt],
  );
  const link = `${APP_URL}/auth/verify-email?token=${token}`;
  const tmpl = verifyEmailTemplate({ name, link });
  return sendEmail({ to: email, ...tmpl });
}

function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!local || !domain) return email;
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}



async function issueSession(userId, req) {
  const token = makeToken();
  const ttl   = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  const ua    = (req.get('User-Agent') || '').slice(0, 255);
  const ip    = (req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip || '').slice(0, 45);
  await query(
    `INSERT INTO sessions (token, user_id, expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?)`,
    [token, userId, ttl, ua, ip],
  );
  return token;
}

async function publicUser(id) {
  const u = await one(
    `SELECT id, email, name, calling, anchor_verse AS anchorVerse, day_start AS dayStart,
            timezone, tier, email_verified AS emailVerified, email_verified_at AS emailVerifiedAt,
            created_at AS createdAt, last_login_at AS lastLoginAt
     FROM users WHERE id = ?`,
    [id],
  );
  if (u) u.emailVerified = !!u.emailVerified;
  return u;
}

// Middleware: resolve req.user from Authorization: Bearer <token>
export async function authMiddleware(req, _res, next) {
  const token = req.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return next();
  const row = await one(
    `SELECT s.user_id AS userId, s.expires_at AS expiresAt
     FROM sessions s WHERE s.token = ?`,
    [token],
  );
  if (!row) return next();
  if (new Date(row.expiresAt) < new Date()) {
    await query('DELETE FROM sessions WHERE token = ?', [token]);
    return next();
  }
  req.user = { id: row.userId };
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'not authenticated' });
  next();
}
