// MIRACLE backend entry — Express + MySQL.
//
// Run locally: `cd server && cp .env.example .env && npm install && npm start`
// Or from repo root: `npm start` (delegates via the workspace package.json).
//
// API endpoints:
//   POST   /auth/signup       { email, password, name?, calling? }
//   POST   /auth/login        { email, password }
//   POST   /auth/logout       (Authorization: Bearer <token>)
//   GET    /auth/me           (Authorization: Bearer <token>)
//   GET    /sync/:store              list rows for the user
//   GET    /sync/:store/:key         fetch one row by pk
//   PUT    /sync/:store              upsert one row (body = entry json)
//   DELETE /sync/:store/:key         delete one row
//   POST   /sync/bulk         { store, rows: [] }   upsert many
//
// Diagnostics:
//   GET /health          — liveness (always 200; safe for Railway healthcheck)
//   GET /health/db       — readiness (503 if MySQL is unreachable)
//   GET /version         — build token for cache-bust correlation
//
// Static: everything not matching an API prefix serves from /public with SPA fallback.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { auth, authMiddleware } from './auth.js';
import { sync } from './sync.js';
import { nes } from './nes.js';
import { pool, ensureSchema } from './db.js';

// ─── Paths + constants ────────────────────────────────────────────
const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

/** All HTTP path prefixes the API owns. Any GET that doesn't start with one of these
 *  falls through to the SPA index.html. Single source of truth — every new API
 *  route added below must also appear here. */
const API_PREFIXES = ['/auth', '/sync', '/nes', '/health', '/version'];

/** Static-file Cache-Control rules. First match wins. */
const CACHE_RULES = [
  { test: /game-preview[\\/]/,                          cc: 'no-cache, max-age=0, must-revalidate' },
  { test: /\.html$/,                                  cc: 'no-cache, no-store, must-revalidate' },
  { test: /(^|\/)sw\.js$/,                            cc: 'no-cache, no-store, must-revalidate' },
  { test: /\.(css|js|svg|png|jpg|jpeg|woff2?|ttf)$/,  cc: 'public, max-age=31536000, immutable' },
];

/** Build token — used by the frontend for cache-bust. Set at process start. */
const BUILD_TOKEN = process.env.RAILWAY_DEPLOYMENT_ID
  || process.env.RAILWAY_GIT_COMMIT_SHA
  || String(Date.now());

// ─── App ──────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '4mb' }));

const ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ORIGINS.length === 0 || ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('CORS denied'));
  },
  credentials: false,
  exposedHeaders: ['Authorization'],
}));

// ─── Health ───────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'miracle-server', build: BUILD_TOKEN });
});

app.get('/health/db', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (e) {
    res.status(503).json({ ok: false, db: 'down', error: e.message });
  }
});

app.get('/version', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json({ build: BUILD_TOKEN });
});

app.get('/build.json', (_req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json({ build: BUILD_TOKEN, builtAt: new Date().toISOString() });
});

// ─── Authed API ───────────────────────────────────────────────────
app.use(authMiddleware);
app.use('/auth', auth);
app.use('/sync', sync);
app.use('/nes',  nes);

// ─── Build-token rewrite for entry points ─────────────────────────
// index.html and sw.js contain the literal `__BUILD__` placeholder. We rewrite
// it to BUILD_TOKEN on every fetch so cache-bust queries (?v=…) and SW
// CACHE_VERSION change for every deploy without anyone bumping a number.
function sendWithBuildToken(res, absPath, contentType) {
  fs.readFile(absPath, 'utf8')
    .then(text => {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Content-Type', contentType);
      res.send(text.replaceAll('__BUILD__', BUILD_TOKEN));
    })
    .catch(err => res.status(500).send(err.message));
}

app.get(['/', '/index.html'], (_req, res) => {
  res.redirect(302, '/game-preview/');
});

app.get('/sw.js', (_req, res) => {
  sendWithBuildToken(res, path.join(PUBLIC_DIR, 'sw.js'), 'application/javascript; charset=utf-8');
});

// The Living House owns a nested PWA scope. Serve its entry and modules with
// the deployment token replaced just like the root shell so Railway and local
// development receive the same cache-safe behavior as the Cloudflare build.
app.get(['/game-preview', '/game-preview/', '/game-preview/index.html'], (_req, res) => {
  sendWithBuildToken(res, path.join(PUBLIC_DIR, 'game-preview', 'index.html'), 'text/html; charset=utf-8');
});

app.get(/^\/game-preview\/([a-z0-9-]+\.js)$/i, (req, res) => {
  sendWithBuildToken(
    res,
    path.join(PUBLIC_DIR, 'game-preview', req.params[0]),
    'application/javascript; charset=utf-8',
  );
});

// ─── CSS bundle ────────────────────────────────────────────────────
// Cascade order matters — keep this list in sync with anything new added under
// public/styles/. Cached in memory; busted by BUILD_TOKEN so each deploy is fresh.
const CSS_ORDER = [
  'tokens.css', 'themes.css', 'base.css', 'layout.css', 'components.css',
  'book.css', 'motion.css', 'domains.css', 'micro.css', 'mobile.css',
  'rewards.css', 'sidebar.css', 'dashboard.css', 'finance.css', 'editorial.css',
  'bitmoji.css', 'focus.css', 'features.css', 'brand.css',
];
let cssBundle = null;

async function getCssBundle() {
  if (cssBundle) return cssBundle;
  const parts = await Promise.all(
    CSS_ORDER.map(async name => {
      const text = await fs.readFile(path.join(PUBLIC_DIR, 'styles', name), 'utf8');
      return `/* ─── ${name} ─── */\n${text}`;
    }),
  );
  cssBundle = parts.join('\n\n');
  return cssBundle;
}

app.get('/styles/bundle.css', async (_req, res) => {
  try {
    const css = await getCssBundle();
    res.set('Content-Type', 'text/css; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(css);
  } catch (e) {
    res.status(500).send(`/* bundle error: ${e.message} */`);
  }
});

// ─── Static PWA + SPA fallback ────────────────────────────────────
app.use(express.static(PUBLIC_DIR, {
  index: false,                                          // we serve index.html ourselves above
  setHeaders: (res, filePath) => {
    const rule = CACHE_RULES.find(r => r.test.test(filePath));
    if (rule) res.setHeader('Cache-Control', rule.cc);
  },
}));

app.get('*', (req, res, next) => {
  // Let API 404s surface as JSON instead of returning the SPA shell.
  if (API_PREFIXES.some(p => req.path.startsWith(p))) return next();
  sendWithBuildToken(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html; charset=utf-8');
});

// ─── Error handler ────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'internal error' });
});

// ─── Listen ───────────────────────────────────────────────────────
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';

// Apply schema in the background — keeps /health green while MySQL is warming up.
ensureSchema().catch(err => console.error('[ensureSchema] failed:', err.message));

app.listen(PORT, HOST, () => {
  console.log(`miracle backend listening on http://${HOST}:${PORT}  (build ${BUILD_TOKEN})`);
});
