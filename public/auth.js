// Frontend auth client — talks to the Node/Express + MySQL backend.
// Stores session token in localStorage; exposes login/signup/logout helpers.

const API_KEY     = 'miracle_api_base';
const TOKEN_KEY   = 'miracle_session_token';
const USER_KEY    = 'miracle_session_user';

// Resolve the API base, in order of precedence:
//   1. localStorage `miracle_api_base` (per-device user override)
//   2. localhost  → http://localhost:8080  (so local dev hits local backend)
//   3. <meta name="miracle-api" content="..."> in index.html
//   4. fallback   → https://api.miracleapp.site
function resolveDefaultApi() {
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8080';
  const meta = document.querySelector('meta[name="miracle-api"]')?.content?.trim();
  if (meta) return meta.replace(/\/$/, '');
  // Empty/missing meta → same-origin (Express serves both static and API)
  return '';
}

// Migration: wipe stale overrides pointing at the dead api.miracleapp.site subdomain.
(function migrateStaleApiOverride() {
  try {
    const v = localStorage.getItem(API_KEY);
    if (v && /^https?:\/\/api\.miracleapp\.site\/?$/i.test(v)) {
      localStorage.removeItem(API_KEY);
    }
  } catch {}
})();

export function getApiBase() {
  return localStorage.getItem(API_KEY) || resolveDefaultApi();
}

export function setApiBase(url) {
  if (url) localStorage.setItem(API_KEY, url.replace(/\/$/, ''));
  else     localStorage.removeItem(API_KEY);
}

export function getToken()  { return localStorage.getItem(TOKEN_KEY); }
export function getCachedUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
  catch { return null; }
}

export function isAuthed() { return !!getToken(); }

export async function signup({ email, password, name, calling, anchorVerse, dayStart, timezone }) {
  const res = await fetch(`${getApiBase()}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, calling, anchorVerse, dayStart, timezone }),
  });
  return finishAuth(res);
}

export async function login({ email, password }) {
  const res = await fetch(`${getApiBase()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return finishAuth(res);
}

export async function logout() {
  const token = getToken();
  try {
    if (token) {
      await fetch(`${getApiBase()}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch { /* ignore network errors on logout */ }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: null } }));
}

export async function me() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${getApiBase()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
      return null;
    }
    const { user } = await res.json();
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch { return getCachedUser(); }
}

// Authenticated fetch helper for /sync endpoints
export async function apiFetch(path, init = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(init.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${getApiBase()}${path}`, { ...init, headers });
}

async function finishAuth(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `auth failed (${res.status})`);
  if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
  if (data.user)  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  window.dispatchEvent(new CustomEvent('auth:changed', { detail: { user: data.user } }));
  return data;
}

// ══════════════════════════════════════════════════════════════
// EMAIL VERIFICATION / PASSWORD RESET / PIN RESET
// ══════════════════════════════════════════════════════════════

export async function sendVerificationEmail() {
  const token = getToken();
  if (!token) throw new Error('not logged in');
  const res = await fetch(`${getApiBase()}/auth/send-verification`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'could not send');
  return data;
}

export async function forgotPassword(email) {
  await fetch(`${getApiBase()}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => {});
  // Always succeeds from the caller's POV (anti-enumeration on server too)
  return { ok: true };
}

export async function resetPassword({ token, password }) {
  const res = await fetch(`${getApiBase()}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'reset failed');
  return data;
}

export async function requestPinResetOtp() {
  const token = getToken();
  if (!token) throw new Error('log in first — PIN reset goes through your verified email');
  const res = await fetch(`${getApiBase()}/auth/forgot-pin`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'could not send code');
    err.needsVerification = !!data.needsVerification;
    throw err;
  }
  return data;
}

export async function verifyPinResetOtp(otp) {
  const token = getToken();
  if (!token) throw new Error('not logged in');
  const res = await fetch(`${getApiBase()}/auth/verify-pin-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ otp }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'verify failed');
    err.attemptsLeft = data.attemptsLeft;
    throw err;
  }
  return data;
}
