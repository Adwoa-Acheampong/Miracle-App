import {
  STORE_COLS,
  entryKeyFor,
  json,
  methodNotAllowed,
  parseEntry,
  pathParts,
  readJson,
  requireUser,
  resolveStore,
} from '../_lib/common.js';

export async function onRequest(context) {
  try {
    const method = context.request.method.toUpperCase();
    const parts = pathParts(context.params.path);
    const user = await requireUser(context.env, context.request);

    if (method === 'OPTIONS') return new Response(null, { status: 204 });
    if (method === 'POST' && parts[0] === 'bulk') return bulk(context, user);

    const store = resolveStore(parts[0]);
    if (!store || !STORE_COLS[store]) return json({ error: 'unknown store' }, { status: 404 });

    if (method === 'GET' && parts.length === 1) return list(context, user, store);
    if (method === 'GET' && parts.length >= 2) return getOne(context, user, store, parts.slice(1).join('/'));
    if (method === 'PUT' && parts.length === 1) return putOne(context, user, store);
    if (method === 'DELETE' && parts.length >= 2) return deleteOne(context, user, store, parts.slice(1).join('/'));
    return methodNotAllowed();
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[sync]', err);
    return json({ error: 'sync failed' }, { status: 500 });
  }
}

async function list({ env }, user, store) {
  const { results } = await env.DB.prepare(
    `SELECT data FROM entries WHERE user_id = ? AND store = ? ORDER BY updated_at DESC`,
  ).bind(user.id, store).all();
  return json({ rows: results.map(parseEntry).filter(Boolean) });
}

async function getOne({ env }, user, store, key) {
  const row = await env.DB.prepare(
    `SELECT data FROM entries WHERE user_id = ? AND store = ? AND entry_key = ?`,
  ).bind(user.id, store, key).first();
  return json({ row: parseEntry(row) });
}

async function putOne({ request, env }, user, store) {
  const value = await readJson(request);
  if (!value || typeof value !== 'object') return json({ error: 'body must be a json object' }, { status: 400 });
  const key = entryKeyFor(store, value);
  if (!key) return json({ error: `missing ${STORE_COLS[store].pk}` }, { status: 400 });
  await saveEntry(env, user.id, store, key, value);
  return json({ ok: true });
}

async function deleteOne({ env }, user, store, key) {
  await env.DB.prepare(
    `DELETE FROM entries WHERE user_id = ? AND store = ? AND entry_key = ?`,
  ).bind(user.id, store, key).run();
  return json({ ok: true });
}

async function bulk({ request, env }, user) {
  const body = await readJson(request);
  const store = resolveStore(body?.store);
  const rows = body?.rows;
  if (!store || !STORE_COLS[store] || !Array.isArray(rows)) {
    return json({ error: 'bad request' }, { status: 400 });
  }

  let saved = 0;
  for (const value of rows) {
    if (!value || typeof value !== 'object') continue;
    const key = entryKeyFor(store, value);
    if (!key) continue;
    await saveEntry(env, user.id, store, key, value);
    saved++;
  }
  return json({ ok: true, saved });
}

async function saveEntry(env, userId, store, key, value) {
  await env.DB.prepare(
    `INSERT INTO entries (user_id, store, entry_key, data, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, store, entry_key)
     DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`,
  ).bind(userId, store, String(key), JSON.stringify(value)).run();
}
