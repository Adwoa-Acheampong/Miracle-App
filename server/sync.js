// Sync routes — push/pull/list entries per store.
// All routes require auth and scope to req.user.id.

import express from 'express';
import { query, one } from './db.js';
import { requireAuth } from './auth.js';

export const sync = express.Router();
sync.use(requireAuth);

// Each store's column spec: which JSON fields get hoisted to indexed columns.
const STORE_COLS = {
  daily:         { pk: 'date',  indexed: [] },
  dreams:        { pk: 'id',    indexed: ['status', 'dream_date:dreamDate', 'fulfilled_on:fulfilledOn'] },
  ideas:         { pk: 'id',    indexed: ['status'] },
  bible:         { pk: 'id',    indexed: ['passage_book:passageBook', 'passage_chapter:passageChapter', 'passage'] },
  prayers:       { pk: 'id',    indexed: ['status', 'answer', 'answered_on:answeredOn', 'started_on:startedOn'] },
  fasts:         { pk: 'id',    indexed: ['started_at:startedAt', 'ended_at:endedAt'] },
  plans:         { pk: 'id',    indexed: ['venture', 'phase', 'status'] },
  projects:      { pk: 'id',    indexed: ['parent_plan:parentPlan', 'phase', 'status'] },
  tasks:         { pk: 'id',    indexed: ['priority', 'scheduled_for:scheduledFor', 'completed_at:completedAt'] },
  events:        { pk: 'id',    indexed: ['start_at:startAt', 'end_at:endAt', 'completed_at:completedAt'] },
  meals:         { pk: 'id',    indexed: ['date', 'slot', 'completed_at:completedAt'] },
  transactions:  { pk: 'id',    indexed: ['date', 'direction', 'amount_ghs:amountGhs', 'category', 'venture', 'tithe'] },
  budgets:       { pk: 'id',    indexed: ['period', 'category', 'limit_ghs:limitGhs'] },
  blogs:         { pk: 'id',    indexed: ['status'] },
  testimonies:   { pk: 'id',    indexed: ['date', 'status'] },
  music:         { pk: 'id',    indexed: ['date'] },
  people:        { pk: 'id',    indexed: ['name', 'last_touched_at:lastTouchedAt'] },
  books:         { pk: 'id',    indexed: ['status', 'title'] },
  quizzes:       { pk: 'id',    indexed: ['source_store:sourceStore', 'status', 'next_due_at:nextDueAt'] },
  goals:         { pk: 'id',    indexed: ['period', 'status', 'domain'] },
  kpi_targets:   { pk: 'id',    indexed: ['metric', 'domain', 'period', 'target_val:target'] },
  focus_sessions:{ pk: 'id',    indexed: ['task_id:taskId', 'status', 'mode', 'started_at:startedAt'] },
  meta:          { pk: 'meta_key:key', indexed: [] },
};
const STORE_ALIAS = { kpiTargets: 'kpi_targets', focusSessions: 'focus_sessions' };

function resolveStore(name) {
  return STORE_ALIAS[name] || name;
}

function splitCol(spec) {
  const [col, jsonKey] = spec.includes(':') ? spec.split(':') : [spec, spec];
  return { col, jsonKey };
}

// GET /sync/:store — list all entries for the user
sync.get('/:store', async (req, res) => {
  const store = resolveStore(req.params.store);
  if (!STORE_COLS[store]) return res.status(404).json({ error: 'unknown store' });
  try {
    const rows = await query(`SELECT data FROM \`${store}\` WHERE user_id = ?`, [req.user.id]);
    res.json({ rows: rows.map(r => parseJson(r.data)) });
  } catch (e) {
    console.error('list', e);
    res.status(500).json({ error: 'list failed' });
  }
});

// GET /sync/:store/:key — fetch a single entry by primary key
sync.get('/:store/:key', async (req, res) => {
  const store = resolveStore(req.params.store);
  const spec  = STORE_COLS[store];
  if (!spec) return res.status(404).json({ error: 'unknown store' });
  try {
    const { col } = splitCol(spec.pk);
    const row = await one(`SELECT data FROM \`${store}\` WHERE user_id = ? AND \`${col}\` = ?`, [req.user.id, req.params.key]);
    res.json({ row: row ? parseJson(row.data) : null });
  } catch (e) {
    console.error('get', e);
    res.status(500).json({ error: 'get failed' });
  }
});

// PUT /sync/:store — upsert one entry. Body = entry value (JSON).
sync.put('/:store', async (req, res) => {
  const store = resolveStore(req.params.store);
  const spec  = STORE_COLS[store];
  if (!spec) return res.status(404).json({ error: 'unknown store' });
  const value = req.body;
  if (!value || typeof value !== 'object') return res.status(400).json({ error: 'body must be a json object' });

  try {
    const { col: pkCol, jsonKey: pkJson } = splitCol(spec.pk);
    const pkVal = value[pkJson];
    if (!pkVal) return res.status(400).json({ error: `missing ${pkJson}` });

    // Hoist indexed columns from value
    const cols = ['user_id', pkCol];
    const placeholders = ['?', '?'];
    const params = [req.user.id, pkVal];
    const updates = [];
    for (const idx of spec.indexed) {
      const { col, jsonKey } = splitCol(idx);
      cols.push(col);
      placeholders.push('?');
      const v = jsonKey === 'tithe' ? (value[jsonKey] === 'yes' || value[jsonKey] === true ? 1 : 0) : (value[jsonKey] ?? null);
      params.push(v);
      updates.push(`\`${col}\` = VALUES(\`${col}\`)`);
    }
    cols.push('data');
    placeholders.push('?');
    params.push(JSON.stringify(value));
    updates.push('data = VALUES(data)');

    await query(
      `INSERT INTO \`${store}\` (${cols.map(c => `\`${c}\``).join(', ')})
       VALUES (${placeholders.join(', ')})
       ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
      params,
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('put', e);
    res.status(500).json({ error: 'put failed' });
  }
});

// DELETE /sync/:store/:key
sync.delete('/:store/:key', async (req, res) => {
  const store = resolveStore(req.params.store);
  const spec  = STORE_COLS[store];
  if (!spec) return res.status(404).json({ error: 'unknown store' });
  try {
    const { col } = splitCol(spec.pk);
    await query(`DELETE FROM \`${store}\` WHERE user_id = ? AND \`${col}\` = ?`, [req.user.id, req.params.key]);
    res.json({ ok: true });
  } catch (e) {
    console.error('del', e);
    res.status(500).json({ error: 'delete failed' });
  }
});

// POST /sync/bulk — push many entries at once { store, rows }
sync.post('/bulk', async (req, res) => {
  const { store: rawStore, rows } = req.body || {};
  const store = resolveStore(rawStore);
  const spec  = STORE_COLS[store];
  if (!spec || !Array.isArray(rows)) return res.status(400).json({ error: 'bad request' });

  let saved = 0;
  for (const value of rows) {
    if (!value || typeof value !== 'object') continue;
    const { col: pkCol, jsonKey: pkJson } = splitCol(spec.pk);
    const pkVal = value[pkJson];
    if (!pkVal) continue;
    const cols = ['user_id', pkCol];
    const placeholders = ['?', '?'];
    const params = [req.user.id, pkVal];
    const updates = [];
    for (const idx of spec.indexed) {
      const { col, jsonKey } = splitCol(idx);
      cols.push(col);
      placeholders.push('?');
      const v = jsonKey === 'tithe' ? (value[jsonKey] === 'yes' || value[jsonKey] === true ? 1 : 0) : (value[jsonKey] ?? null);
      params.push(v);
      updates.push(`\`${col}\` = VALUES(\`${col}\`)`);
    }
    cols.push('data');
    placeholders.push('?');
    params.push(JSON.stringify(value));
    updates.push('data = VALUES(data)');
    try {
      await query(
        `INSERT INTO \`${store}\` (${cols.map(c => `\`${c}\``).join(', ')})
         VALUES (${placeholders.join(', ')})
         ON DUPLICATE KEY UPDATE ${updates.join(', ')}`,
        params,
      );
      saved++;
    } catch (e) { console.error('bulk row', e); }
  }
  res.json({ ok: true, saved });
});

function parseJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return v; }
}
