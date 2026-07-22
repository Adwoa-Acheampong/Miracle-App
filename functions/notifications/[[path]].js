import { json, methodNotAllowed, pathParts, readJson, requireUser } from '../_lib/common.js';

export async function onRequest(context) {
  try {
    const method = context.request.method.toUpperCase();
    const [route] = pathParts(context.params.path);
    if (method === 'GET' && route === 'vapid-key') return vapidKey(context);
    if (method === 'POST' && route === 'subscribe') return subscribe(context);
    if (method === 'DELETE' && route === 'subscribe') return unsubscribe(context);
    if (method === 'GET' && route === 'preferences') return getPreferences(context);
    if (method === 'PUT' && route === 'preferences') return putPreferences(context);
    if (method === 'POST' && route === 'daily-state') return putDailyState(context);
    return methodNotAllowed();
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('[notifications]', error);
    return json({ error: 'notification service failed' }, { status: 500 });
  }
}

function vapidKey({ env }) {
  if (!env.VAPID_PUBLIC_KEY) return json({ error: 'push keys are not configured' }, { status: 503 });
  return json({ publicKey: env.VAPID_PUBLIC_KEY });
}

async function subscribe({ request, env }) {
  const user = await requireUser(env, request);
  const body = await readJson(request);
  const subscription = body?.subscription;
  const endpoint = String(subscription?.endpoint || '');
  const p256dh = String(subscription?.keys?.p256dh || '');
  const auth = String(subscription?.keys?.auth || '');
  if (!endpoint.startsWith('https://') || endpoint.length > 2048 || !p256dh || !auth || p256dh.length > 256 || auth.length > 128) {
    return json({ error: 'invalid push subscription' }, { status: 400 });
  }
  const timezone = safeTimezone(body?.timezone);
  const locale = String(body?.locale || 'en').slice(0, 32);
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, expiration_time, timezone, locale, enabled)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh,
       auth = excluded.auth, expiration_time = excluded.expiration_time, timezone = excluded.timezone,
       locale = excluded.locale, enabled = 1, updated_at = CURRENT_TIMESTAMP`,
  ).bind(endpoint, user.id, p256dh, auth, subscription.expirationTime || null, timezone, locale).run();
  return json({ ok: true });
}

async function unsubscribe({ request, env }) {
  const user = await requireUser(env, request);
  const body = await readJson(request);
  const endpoint = String(body?.endpoint || '');
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1 AND user_id = ?2').bind(endpoint, user.id).run();
  await env.DB.prepare('UPDATE reminder_preferences SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?1').bind(user.id).run();
  return json({ ok: true });
}

async function getPreferences({ request, env }) {
  const user = await requireUser(env, request);
  const row = await env.DB.prepare(
    `SELECT enabled, morning_time AS morningTime, follow_time AS followTime,
            quiet_from AS quietFrom, quiet_until AS quietUntil, timezone
       FROM reminder_preferences WHERE user_id = ?1`,
  ).bind(user.id).first();
  if (row) row.enabled = !!row.enabled;
  return json({ preferences: row || null });
}

async function putPreferences({ request, env }) {
  const user = await requireUser(env, request);
  const body = await readJson(request);
  const morningTime = safeTime(body?.morningTime, '07:30');
  const followTime = safeTime(body?.followTime, '19:00');
  const quietFrom = safeTime(body?.quietFrom, '21:30');
  const quietUntil = safeTime(body?.quietUntil, '07:00');
  const timezone = safeTimezone(body?.timezone);
  const enabled = body?.enabled ? 1 : 0;
  await env.DB.prepare(
    `INSERT INTO reminder_preferences (user_id, enabled, morning_time, follow_time, quiet_from, quiet_until, timezone)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT(user_id) DO UPDATE SET enabled = excluded.enabled, morning_time = excluded.morning_time,
       follow_time = excluded.follow_time, quiet_from = excluded.quiet_from, quiet_until = excluded.quiet_until,
       timezone = excluded.timezone, updated_at = CURRENT_TIMESTAMP`,
  ).bind(user.id, enabled, morningTime, followTime, quietFrom, quietUntil, timezone).run();
  return json({ ok: true });
}

async function putDailyState({ request, env }) {
  const user = await requireUser(env, request);
  const body = await readJson(request);
  const date = String(body?.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'invalid date' }, { status: 400 });
  const resolved = boundedInt(body?.resolved, 0, 100);
  const total = boundedInt(body?.total, 0, 100);
  const openLoops = boundedInt(body?.openLoops, 0, 1000);
  const complete = body?.complete ? 1 : 0;
  await env.DB.prepare(
    `INSERT INTO reminder_daily_state (user_id, date, resolved, total, open_loops, complete)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(user_id, date) DO UPDATE SET resolved = excluded.resolved, total = excluded.total,
       open_loops = excluded.open_loops, complete = excluded.complete, updated_at = CURRENT_TIMESTAMP`,
  ).bind(user.id, date, resolved, total, openLoops, complete).run();
  return json({ ok: true });
}

function safeTime(value, fallback) {
  const time = String(value || '');
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : fallback;
}

function safeTimezone(value) {
  const timezone = String(value || 'UTC').slice(0, 64);
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
    return timezone;
  } catch {
    return 'UTC';
  }
}

function boundedInt(value, min, max) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min;
}
