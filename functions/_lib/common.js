const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const SESSION_TTL_DAYS = 30;
const PASSWORD_ITERATIONS = 10000;

export const STORE_COLS = {
  daily: { pk: 'date' },
  dreams: { pk: 'id' },
  ideas: { pk: 'id' },
  bible: { pk: 'id' },
  prayers: { pk: 'id' },
  prophecies: { pk: 'id' },
  fasts: { pk: 'id' },
  plans: { pk: 'id' },
  projects: { pk: 'id' },
  tasks: { pk: 'id' },
  events: { pk: 'id' },
  meals: { pk: 'id' },
  transactions: { pk: 'id' },
  budgets: { pk: 'id' },
  blogs: { pk: 'id' },
  testimonies: { pk: 'id' },
  music: { pk: 'id' },
  people: { pk: 'id' },
  books: { pk: 'id' },
  quizzes: { pk: 'id' },
  goals: { pk: 'id' },
  kpi_targets: { pk: 'id' },
  focus_sessions: { pk: 'id' },
  feedback: { pk: 'id' },
  voiceProfiles: { pk: 'id' },
  postMetrics: { pk: 'id' },
  fti: { pk: 'date' },
  tags: { pk: 'name' },
  meta: { pk: 'key' },
};

const STORE_ALIAS = {
  kpiTargets: 'kpi_targets',
  focusSessions: 'focus_sessions',
};

export function resolveStore(name) {
  return STORE_ALIAS[name] || name;
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-cache');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function methodNotAllowed() {
  return json({ error: 'method not allowed' }, { status: 405 });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function pathParts(param) {
  if (!param) return [];
  return Array.isArray(param) ? param.filter(Boolean) : String(param).split('/').filter(Boolean);
}

export function emailOk(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function passwordOk(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 200;
}

export function clientIp(request) {
  return (request.headers.get('CF-Connecting-IP')
    || request.headers.get('x-forwarded-for')?.split(',')[0]
    || '').slice(0, 45);
}

export function userAgent(request) {
  return (request.headers.get('User-Agent') || '').slice(0, 255);
}

export function appUrl(request, env) {
  return String(env.APP_URL || new URL(request.url).origin).replace(/\/$/, '');
}

export function tokenFromRequest(request) {
  return request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
}

export async function publicUser(env, id) {
  const user = await env.DB.prepare(
    `SELECT id, email, name, calling, anchor_verse AS anchorVerse, day_start AS dayStart,
            timezone, tier, email_verified AS emailVerified, email_verified_at AS emailVerifiedAt,
            created_at AS createdAt, last_login_at AS lastLoginAt
       FROM users WHERE id = ?`,
  ).bind(id).first();
  if (user) user.emailVerified = !!user.emailVerified;
  return user || null;
}

export async function getAuthedUser(env, request) {
  const token = tokenFromRequest(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT user_id AS userId, expires_at AS expiresAt FROM sessions WHERE token = ?`,
  ).bind(token).first();
  if (!row) return null;
  if (new Date(row.expiresAt) < new Date()) {
    await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return null;
  }
  return { id: row.userId, token };
}

export async function requireUser(env, request) {
  const user = await getAuthedUser(env, request);
  if (!user) throw new Response(JSON.stringify({ error: 'not authenticated' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
  return user;
}

export async function issueSession(env, userId, request) {
  const token = randomHex(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000).toISOString();
  await env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at, user_agent, ip)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(token, userId, expiresAt, userAgent(request), clientIp(request)).run();
  return token;
}

export function entryKeyFor(store, value) {
  const spec = STORE_COLS[store];
  if (!spec) return null;
  return value?.[spec.pk] || null;
}

export function parseEntry(row) {
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return row.data;
  }
}

export function ulid() {
  return encodeTime(Date.now(), 10) + encodeRandom(16);
}

function encodeTime(now, len) {
  let out = '';
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % 32;
    out = ENCODING[mod] + out;
    now = (now - mod) / 32;
  }
  return out;
}

function encodeRandom(len) {
  const bytes = randomBytes(len);
  let out = '';
  for (const byte of bytes) out += ENCODING[byte % 32];
  return out;
}

export function randomHex(byteLength) {
  return [...randomBytes(byteLength)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomBytes(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function hashPassword(password) {
  const salt = base64url(randomBytes(16));
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return `pbkdf2-sha256:${PASSWORD_ITERATIONS}:${salt}:${hash}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 10000) return false;
  const hash = await derivePassword(password, parts[2], iterations);
  return constantTimeEqual(hash, parts[3]);
}

async function derivePassword(password, saltB64, iterations) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: unbase64url(saltB64), iterations },
    key,
    256,
  );
  return base64url(new Uint8Array(bits));
}

function base64url(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function unbase64url(value) {
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function constantTimeEqual(a, b) {
  const left = String(a);
  const right = String(b);
  let diff = left.length === right.length ? 0 : 1;
  const len = Math.max(left.length, right.length);
  for (let i = 0; i < len; i++) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}
