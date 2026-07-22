// Nes agent tools — full CRUD + summaries across the MIRACLE journal.
// Every function takes (userId, args) and returns a JSON-serialisable result.
//
// Stores covered: tasks · ideas · prayers · bible · dreams · testimonies · blogs ·
// projects · plans · people · books · events · fasts · meals · transactions · daily ·
// music · focus

import { query, one } from './db.js';
import { ulid } from './ulid.js';

// ============================================================
// EXECUTOR
// ============================================================

export async function executeTool(name, args, userId) {
  switch (name) {
    // -- read --
    case 'search_entries':     return await searchEntries(userId, args);
    case 'get_recent':         return await getRecent(userId, args);
    case 'get_entry':          return await getEntry(userId, args);
    case 'get_user_profile':   return await getUserProfile(userId);
    case 'get_open_tasks':     return await getOpenTasks(userId, args);
    case 'get_open_prayers':   return await getOpenPrayers(userId);
    case 'get_fti':            return await getFti(userId);
    case 'count_entries':      return await countEntries(userId, args);

    // -- create --
    case 'create_idea':        return await createIdea(userId, args);
    case 'create_task':        return await createTask(userId, args);
    case 'create_prayer':      return await createPrayer(userId, args);
    case 'create_verse_study': return await createVerseStudy(userId, args);
    case 'create_testimony':   return await createTestimony(userId, args);
    case 'create_dream':       return await createDream(userId, args);
    case 'create_prophecy':    return await createProphecy(userId, args);
    case 'fulfill_prophecy':   return await fulfillProphecy(userId, args);
    case 'create_journal':     return await createJournal(userId, args);
    case 'create_blog':        return await createBlog(userId, args);
    case 'create_project':     return await createProject(userId, args);
    case 'create_plan':        return await createPlan(userId, args);
    case 'create_person':      return await createPerson(userId, args);
    case 'create_book':        return await createBook(userId, args);
    case 'create_event':       return await createEvent(userId, args);
    case 'start_fast':         return await startFast(userId, args);
    case 'log_meal':           return await logMeal(userId, args);
    case 'log_transaction':    return await logTransaction(userId, args);

    // -- update --
    case 'update_task':        return await updateEntry(userId, 'tasks',   args.idSuffix, args.patch);
    case 'complete_task':      return await completeTask(userId, args);
    case 'reopen_task':        return await reopenTask(userId, args);
    case 'update_idea':        return await updateEntry(userId, 'ideas',   args.idSuffix, args.patch);
    case 'answer_prayer':      return await answerPrayer(userId, args);
    case 'update_prayer':      return await updateEntry(userId, 'prayers', args.idSuffix, args.patch);
    case 'update_dream':       return await updateEntry(userId, 'dreams',  args.idSuffix, args.patch);
    case 'update_project':     return await updateEntry(userId, 'projects',args.idSuffix, args.patch);
    case 'update_book':        return await updateEntry(userId, 'books',   args.idSuffix, args.patch);
    case 'end_fast':           return await endFast(userId, args);

    // -- delete --
    case 'delete_entry':       return await deleteEntry(userId, args);

    // -- summaries --
    case 'summarize_week':     return await summarizePeriod(userId, 7);
    case 'summarize_month':    return await summarizePeriod(userId, 30);
    case 'summarize_finances': return await summarizeFinances(userId, args);
    case 'summarize_venture':  return await summarizeVenture(userId, args);

    default: throw new Error(`unknown tool: ${name}`);
  }
}

// ============================================================
// READ
// ============================================================

const SEARCHABLE_STORES = [
  'ideas', 'tasks', 'prayers', 'bible', 'dreams', 'testimonies',
  'blogs', 'projects', 'plans', 'people', 'books', 'daily',
];
const ALL_STORES = [
  ...SEARCHABLE_STORES,
  'transactions', 'events', 'fasts', 'meals', 'music',
];

async function searchEntries(userId, { query: q, stores, limit = 12 }) {
  const lim    = Math.min(Math.max(1, limit), 30);
  const target = (Array.isArray(stores) && stores.length)
    ? stores.filter(s => SEARCHABLE_STORES.includes(s))
    : SEARCHABLE_STORES;
  const term = `%${(q || '').toLowerCase().trim()}%`;
  if (!term || term === '%%') return { results: [], hint: 'empty query' };

  const out = [];
  for (const store of target) {
    try {
      const rows = await query(
        `SELECT data FROM \`${store}\` WHERE user_id = ? AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(data, '$'))) LIKE ? ORDER BY updated_at DESC LIMIT ?`,
        [userId, term, lim],
      );
      for (const r of rows) {
        const obj = parseJson(r.data);
        if (!obj) continue;
        out.push({ store, id: obj.id || obj.date || obj.name, ...summarize(store, obj) });
      }
    } catch { /* skip */ }
  }
  out.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return { results: out.slice(0, lim), totalFound: out.length };
}

async function getRecent(userId, { store, limit = 10 }) {
  if (!ALL_STORES.includes(store)) return { error: `unknown store: ${store}` };
  const lim = Math.min(Math.max(1, limit), 30);
  const rows = await query(
    `SELECT data FROM \`${store}\` WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?`,
    [userId, lim],
  );
  return { store, results: rows.map(r => summarize(store, parseJson(r.data))) };
}

async function getEntry(userId, { store, idSuffix }) {
  if (!ALL_STORES.includes(store)) return { error: `unknown store: ${store}` };
  const rows = await findBySuffix(userId, store, idSuffix);
  if (rows.error) return rows;
  return { store, entry: rows.entry };
}

async function getUserProfile(userId) {
  const u = await one(
    `SELECT name, calling, anchor_verse AS anchorVerse, day_start AS dayStart, timezone, tier
     FROM users WHERE id = ?`,
    [userId],
  );
  return u || { error: 'user not found' };
}

async function getOpenTasks(userId, { priority_min } = {}) {
  const rows = await query(
    `SELECT data FROM tasks WHERE user_id = ? AND completed_at IS NULL ORDER BY priority ASC, scheduled_for ASC LIMIT 50`,
    [userId],
  );
  let tasks = rows.map(r => parseJson(r.data)).filter(Boolean);
  if (priority_min) {
    const order = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const cap = order[priority_min] ?? 3;
    tasks = tasks.filter(t => (order[t.priority] ?? 2) <= cap);
  }
  return { count: tasks.length, tasks: tasks.map(t => ({ id: t.id, title: t.title, priority: t.priority, scheduledFor: t.scheduledFor })) };
}

async function getOpenPrayers(userId) {
  const rows = await query(
    `SELECT data FROM prayers WHERE user_id = ? AND (answer IS NULL OR answer = 'pending') ORDER BY updated_at DESC LIMIT 50`,
    [userId],
  );
  const prayers = rows.map(r => parseJson(r.data)).filter(Boolean);
  return { count: prayers.length, prayers: prayers.map(p => ({ id: p.id, subject: p.subject, type: p.type, intensity: p.intensity, startedOn: p.startedOn })) };
}

async function getFti(userId) {
  const [tasks, projects, plans, prayers, bibleEntries, fasts, events] = await Promise.all([
    listAll(userId, 'tasks'),
    listAll(userId, 'projects'),
    listAll(userId, 'plans'),
    listAll(userId, 'prayers'),
    listAll(userId, 'bible'),
    listAll(userId, 'fasts'),
    listAll(userId, 'events'),
  ]);
  const total = tasks.length + projects.length + plans.length + prayers.length + bibleEntries.length + fasts.length + events.length;
  if (total === 0) return { score: 0, fresh: true, note: 'No activity yet.' };
  const closed = tasks.filter(t => t.completedAt).length;
  const closure = tasks.length === 0 ? 0 : closed / tasks.length;
  const score = Math.round(closure * 100);
  return { score, closure, taskCount: tasks.length, closedTasks: closed };
}

async function countEntries(userId, { store, where } = {}) {
  if (!ALL_STORES.includes(store)) return { error: `unknown store: ${store}` };
  const rows = await query(`SELECT COUNT(*) AS n FROM \`${store}\` WHERE user_id = ?`, [userId]);
  return { store, count: rows[0]?.n || 0 };
}

// ============================================================
// CREATE
// ============================================================

async function createIdea(userId, { title, body }) {
  const id = ulid();
  const entry = stamp({
    id, title: (title || body.split('\n')[0]).slice(0, 80), body,
    status: 'active', weight: 50, tags: [],
  });
  await upsert(userId, 'ideas', entry);
  return { ok: true, id, title: entry.title };
}

async function createTask(userId, { title, priority = 'P2', scheduledFor, context = 'shallow', venture }) {
  const id = ulid();
  const date = scheduledFor || today();
  const entry = stamp({
    id, title, priority, scheduledFor: date, context, venture: venture || null,
    status: 'active',
  });
  await upsert(userId, 'tasks', entry);
  return { ok: true, id, title, priority, scheduledFor: date };
}

async function createPrayer(userId, { subject, type = 'supplication', intensity = 3, cadence = 'one-off' }) {
  const id = ulid();
  const entry = stamp({
    id, subject, type, intensity,
    startedOn: today(), answer: 'pending', cadence, status: 'active',
  });
  await upsert(userId, 'prayers', entry);
  return { ok: true, id, subject, type, intensity };
}

async function createVerseStudy(userId, { passage, passageBook, passageChapter, observation, application }) {
  const id = ulid();
  const entry = stamp({
    id, passage, passageBook: passageBook || '', passageChapter: passageChapter || 0,
    observation, application: application || '', translation: 'NIV', status: 'active',
  });
  await upsert(userId, 'bible', entry);
  return { ok: true, id, passage };
}

async function createTestimony(userId, { title, body }) {
  const id = ulid();
  const entry = stamp({
    id, title: (title || body.split('\n')[0]).slice(0, 80), body,
    date: today(), status: 'active',
  });
  await upsert(userId, 'testimonies', entry);
  return { ok: true, id, title: entry.title };
}

async function createProphecy(userId, { word, speaker = '', platform = 'church', dateReceived, scripture = '', theme = '' }) {
  const id = ulid();
  const entry = stamp({
    id, word, speaker, platform,
    dateReceived: dateReceived || today(),
    scripture, theme,
    status: 'active', fulfillmentNotes: '',
  });
  await upsert(userId, 'prophecies', entry);
  return { ok: true, id, word, speaker, platform };
}

async function fulfillProphecy(userId, { idSuffix, fulfillmentNotes = '' }) {
  const found = await findBySuffix(userId, 'prophecies', idSuffix);
  if (found.error) return found;
  const next = {
    ...found.entry,
    status: 'fulfilled',
    fulfilledOn: today(),
    fulfillmentNotes,
    updatedAt: nowIso(),
  };
  await upsert(userId, 'prophecies', next);
  return { ok: true, id: next.id, word: next.word, fulfilledOn: next.fulfilledOn };
}

async function createDream(userId, { body, type = 'nightDream', symbols = [], interpretation }) {
  const id = ulid();
  const entry = stamp({
    id, title: body.split(/[.\n]/)[0].slice(0, 60), body, type, symbols,
    interpretation: interpretation || '',
    dreamDate: today(), status: 'active', weight: 50,
  });
  await upsert(userId, 'dreams', entry);
  return { ok: true, id, type };
}

async function createJournal(userId, { oneSentence, freeform, mood = 'steady', gratitude }) {
  const date = today();
  const entry = stamp({
    date, oneSentence: oneSentence || '', freeform: freeform || '',
    mood, gratitude: gratitude || '', status: 'active',
  });
  await upsertByDate(userId, 'daily', entry);
  return { ok: true, id: date, mood, oneSentence: entry.oneSentence };
}

async function createBlog(userId, { title, hook, seedText, status = 'idea' }) {
  const id = ulid();
  const entry = stamp({
    id, title, hook: hook || '', seedText: seedText || '', status,
    publishedAt: null,
  });
  await upsert(userId, 'blogs', entry);
  return { ok: true, id, title, status };
}

async function createProject(userId, { title, phase = 'discovery', venture, vision }) {
  const id = ulid();
  const entry = stamp({
    id, title, phase, venture: venture || 'Personal', vision: vision || '',
    status: 'active', milestones: [],
  });
  await upsert(userId, 'projects', entry);
  return { ok: true, id, title, phase, venture: entry.venture };
}

async function createPlan(userId, { title, venture, phase = 'seed', vision }) {
  const id = ulid();
  const entry = stamp({
    id, title, venture: venture || 'Personal', phase, vision: vision || '',
    status: 'active',
  });
  await upsert(userId, 'plans', entry);
  return { ok: true, id, title, venture: entry.venture, phase };
}

async function createPerson(userId, { name, note, venture, role, phone, email }) {
  const id = ulid();
  const entry = stamp({
    id, name, note: note || '', venture: venture || '', role: role || '',
    phone: phone || '', email: email || '', status: 'active',
  });
  await upsert(userId, 'people', entry);
  return { ok: true, id, name };
}

async function createBook(userId, { title, author, status = 'wishlist' }) {
  const id = ulid();
  const entry = stamp({
    id, title, author: author || '', status,
    startedAt: status === 'reading' ? today() : null,
  });
  await upsert(userId, 'books', entry);
  return { ok: true, id, title, status };
}

async function createEvent(userId, { title, startAt, location, durationMin }) {
  const id = ulid();
  const entry = stamp({
    id, title, startAt, location: location || '',
    durationMin: durationMin || 60, status: 'scheduled', debrief: '',
  });
  await upsert(userId, 'events', entry);
  return { ok: true, id, title, startAt };
}

async function startFast(userId, { type = 'water', purpose, plannedHours = 24 }) {
  const id = ulid();
  const entry = stamp({
    id, type, purpose: purpose || '',
    startedAt: new Date().toISOString(), endedAt: null,
    plannedHours, status: 'active', breakthrough: '',
  });
  await upsert(userId, 'fasts', entry);
  return { ok: true, id, type, plannedHours };
}

async function logMeal(userId, { slot = 'lunch', items, mood, location }) {
  const id = ulid();
  const entry = stamp({
    id, date: today(), slot, actualItems: items || '',
    mood: mood || 'neutral', location: location || '',
  });
  await upsert(userId, 'meals', entry);
  return { ok: true, id, slot, items: entry.actualItems };
}

async function logTransaction(userId, { direction, amount, category = 'misc', venture = 'Personal', payee = '', memo = '', tithe = false }) {
  const id = ulid();
  const entry = stamp({
    id, date: today(),
    direction, amountGhs: Number(amount), category, venture, payee, memo,
    tithe: tithe ? 'yes' : 'no', account: 'MoMo',
  });
  await upsert(userId, 'transactions', entry);
  return { ok: true, id, direction, amount: entry.amountGhs, category, venture };
}

// ============================================================
// UPDATE
// ============================================================

async function updateEntry(userId, store, idSuffix, patch = {}) {
  const found = await findBySuffix(userId, store, idSuffix);
  if (found.error) return found;
  const next = { ...found.entry, ...patch, updatedAt: nowIso() };
  await upsert(userId, store, next);
  return { ok: true, id: next.id, store, patch };
}

async function completeTask(userId, { idSuffix }) {
  const found = await findBySuffix(userId, 'tasks', idSuffix);
  if (found.error) return found;
  const next = { ...found.entry, completedAt: nowIso(), status: 'completed', updatedAt: nowIso() };
  await upsert(userId, 'tasks', next);
  await query(`UPDATE tasks SET completed_at = NOW() WHERE user_id = ? AND id = ?`, [userId, next.id]);
  return { ok: true, id: next.id, title: next.title, completedAt: next.completedAt };
}

async function reopenTask(userId, { idSuffix }) {
  const found = await findBySuffix(userId, 'tasks', idSuffix);
  if (found.error) return found;
  const next = { ...found.entry, completedAt: null, status: 'active', updatedAt: nowIso() };
  await upsert(userId, 'tasks', next);
  await query(`UPDATE tasks SET completed_at = NULL WHERE user_id = ? AND id = ?`, [userId, next.id]);
  return { ok: true, id: next.id, title: next.title };
}

async function answerPrayer(userId, { idSuffix, howGod, when }) {
  const found = await findBySuffix(userId, 'prayers', idSuffix);
  if (found.error) return found;
  const next = {
    ...found.entry,
    answer: 'answered', answeredOn: when || today(),
    howGodAnswered: howGod || '', status: 'answered',
    updatedAt: nowIso(),
  };
  await upsert(userId, 'prayers', next);
  return { ok: true, id: next.id, subject: next.subject, answeredOn: next.answeredOn };
}

async function endFast(userId, { idSuffix, breakthrough }) {
  const found = await findBySuffix(userId, 'fasts', idSuffix);
  if (found.error) return found;
  const next = {
    ...found.entry,
    endedAt: nowIso(), breakthrough: breakthrough || '',
    status: 'completed', updatedAt: nowIso(),
  };
  await upsert(userId, 'fasts', next);
  return { ok: true, id: next.id, endedAt: next.endedAt };
}

// ============================================================
// DELETE
// ============================================================

async function deleteEntry(userId, { store, idSuffix }) {
  if (!ALL_STORES.includes(store)) return { error: `unknown store: ${store}` };
  const found = await findBySuffix(userId, store, idSuffix);
  if (found.error) return found;
  await query(`DELETE FROM \`${store}\` WHERE user_id = ? AND id = ?`, [userId, found.entry.id || idSuffix]);
  return { ok: true, store, id: found.entry.id, deleted: true };
}

// ============================================================
// SUMMARIES
// ============================================================

async function summarizePeriod(userId, days) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const [tasks, ideas, prayers, transactions, journal, bibleEntries, testimonies] = await Promise.all([
    query(`SELECT data FROM tasks        WHERE user_id = ? AND updated_at >= ?`, [userId, since]),
    query(`SELECT data FROM ideas        WHERE user_id = ? AND created_at >= ?`, [userId, since]),
    query(`SELECT data FROM prayers      WHERE user_id = ? AND created_at >= ?`, [userId, since]),
    query(`SELECT data FROM transactions WHERE user_id = ? AND created_at >= ?`, [userId, since]),
    query(`SELECT data FROM daily        WHERE user_id = ? AND created_at >= ?`, [userId, since]),
    query(`SELECT data FROM bible        WHERE user_id = ? AND created_at >= ?`, [userId, since]),
    query(`SELECT data FROM testimonies  WHERE user_id = ? AND created_at >= ?`, [userId, since]),
  ].map(p => p.catch(() => [])));

  const taskData = tasks.map(r => parseJson(r.data)).filter(Boolean);
  const completed = taskData.filter(t => t.completedAt && new Date(t.completedAt).toISOString() >= since).length;
  const txns = transactions.map(r => parseJson(r.data)).filter(Boolean);
  const spend  = txns.filter(t => t.direction === 'out').reduce((s, t) => s + Number(t.amountGhs || 0), 0);
  const income = txns.filter(t => t.direction === 'in' ).reduce((s, t) => s + Number(t.amountGhs || 0), 0);
  const answered = (await query(
    `SELECT COUNT(*) AS n FROM prayers WHERE user_id = ? AND JSON_EXTRACT(data, '$.answer') = 'answered' AND updated_at >= ?`,
    [userId, since],
  ))[0]?.n || 0;

  return {
    period: days === 7 ? 'week' : days === 30 ? 'month' : `${days}d`,
    from: since.slice(0, 10),
    to: today(),
    tasksCompleted: completed,
    tasksTouched: taskData.length,
    ideasCaptured: ideas.length,
    prayersLogged: prayers.length,
    prayersAnswered: answered,
    bibleStudies: bibleEntries.length,
    testimonies: testimonies.length,
    journalEntries: journal.length,
    spend: round(spend),
    income: round(income),
    net: round(income - spend),
  };
}

async function summarizeFinances(userId, { period = 'week' } = {}) {
  const days = period === 'month' ? 30 : period === 'year' ? 365 : 7;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = await query(
    `SELECT data FROM transactions WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC`,
    [userId, since],
  );
  const txns = rows.map(r => parseJson(r.data)).filter(Boolean);

  const byCategory = {};
  const byVenture  = {};
  let spend = 0, income = 0, tithe = 0;

  for (const t of txns) {
    const amt = Number(t.amountGhs || 0);
    if (t.direction === 'out') {
      spend += amt;
      byCategory[t.category || 'misc'] = (byCategory[t.category || 'misc'] || 0) + amt;
      byVenture[t.venture || 'Personal'] = (byVenture[t.venture || 'Personal'] || 0) + amt;
    } else if (t.direction === 'in') {
      income += amt;
      if (t.tithe === 'yes') tithe += amt * 0.1;
    }
  }

  return {
    period, from: since.slice(0, 10), to: today(),
    income: round(income), spend: round(spend), net: round(income - spend),
    transactionCount: txns.length,
    expectedTithe: round(tithe),
    topCategories: Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => ({ category: k, amount: round(v) })),
    byVenture: Object.entries(byVenture).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ venture: k, amount: round(v) })),
  };
}

async function summarizeVenture(userId, { venture }) {
  if (!venture) return { error: 'venture name required' };
  const [projects, plans, txns, tasks] = await Promise.all([
    query(`SELECT data FROM projects     WHERE user_id = ? AND JSON_EXTRACT(data, '$.venture') = ?`, [userId, venture]),
    query(`SELECT data FROM plans        WHERE user_id = ? AND JSON_EXTRACT(data, '$.venture') = ?`, [userId, venture]),
    query(`SELECT data FROM transactions WHERE user_id = ? AND JSON_EXTRACT(data, '$.venture') = ? ORDER BY created_at DESC LIMIT 50`, [userId, venture]),
    query(`SELECT data FROM tasks        WHERE user_id = ? AND JSON_EXTRACT(data, '$.venture') = ? AND completed_at IS NULL`, [userId, venture]),
  ].map(p => p.catch(() => [])));

  const projObjs = projects.map(r => parseJson(r.data)).filter(Boolean);
  const planObjs = plans.map(r => parseJson(r.data)).filter(Boolean);
  const txnObjs  = txns.map(r => parseJson(r.data)).filter(Boolean);
  const taskObjs = tasks.map(r => parseJson(r.data)).filter(Boolean);

  const spend  = txnObjs.filter(t => t.direction === 'out').reduce((s, t) => s + Number(t.amountGhs || 0), 0);
  const income = txnObjs.filter(t => t.direction === 'in' ).reduce((s, t) => s + Number(t.amountGhs || 0), 0);

  return {
    venture,
    activeProjects: projObjs.filter(p => p.status === 'active').length,
    projects:  projObjs.map(p => ({ id: p.id, title: p.title, phase: p.phase })),
    plans:     planObjs.map(p => ({ id: p.id, title: p.title, phase: p.phase })),
    openTasks: taskObjs.length,
    tasks:     taskObjs.slice(0, 5).map(t => ({ id: t.id, title: t.title, priority: t.priority })),
    income: round(income), spend: round(spend), net: round(income - spend),
  };
}

// ============================================================
// HELPERS
// ============================================================

async function findBySuffix(userId, store, suffix) {
  if (!suffix) return { error: 'id suffix required' };
  const s = String(suffix).toLowerCase();
  // Match by id column suffix; fall back to scanning JSON if pk is non-id
  const rows = await query(
    `SELECT data FROM \`${store}\` WHERE user_id = ? AND LOWER(id) LIKE ? LIMIT 5`,
    [userId, `%${s}`],
  ).catch(() => []);
  if (rows.length === 0) {
    // fallback: scan recent rows and match json id
    const recent = await query(
      `SELECT data FROM \`${store}\` WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200`,
      [userId],
    ).catch(() => []);
    for (const r of recent) {
      const obj = parseJson(r.data);
      if (obj && String(obj.id || '').toLowerCase().endsWith(s)) return { entry: obj };
    }
    return { error: `no ${store} ending in ${suffix}` };
  }
  if (rows.length > 1) return { error: `${rows.length} matches for ${suffix} — try more characters` };
  return { entry: parseJson(rows[0].data) };
}

async function listAll(userId, store) {
  const rows = await query(`SELECT data FROM \`${store}\` WHERE user_id = ?`, [userId]);
  return rows.map(r => parseJson(r.data)).filter(Boolean);
}

async function upsert(userId, store, entry) {
  const id = entry.id;
  await query(
    `INSERT INTO \`${store}\` (user_id, id, data)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()`,
    [userId, id, JSON.stringify(entry)],
  );
}

async function upsertByDate(userId, store, entry) {
  await query(
    `INSERT INTO \`${store}\` (user_id, date, data)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()`,
    [userId, entry.date, JSON.stringify(entry)],
  );
}

function parseJson(s) {
  if (!s) return null;
  if (typeof s === 'object') return s;
  try { return JSON.parse(s); } catch { return null; }
}

function stamp(o) {
  const ts = nowIso();
  return { ...o, createdAt: o.createdAt || ts, updatedAt: ts };
}

function nowIso() { return new Date().toISOString(); }
function today()  { return new Date().toISOString().slice(0, 10); }
function round(n) { return Math.round(Number(n) * 100) / 100; }

function summarize(store, obj) {
  if (!obj) return {};
  const base = { updatedAt: obj.updatedAt };
  switch (store) {
    case 'ideas':        return { ...base, title: obj.title, snippet: snip(obj.body) };
    case 'tasks':        return { ...base, title: obj.title, priority: obj.priority, scheduledFor: obj.scheduledFor, completed: !!obj.completedAt };
    case 'prayers':      return { ...base, subject: obj.subject, type: obj.type, intensity: obj.intensity, answer: obj.answer };
    case 'bible':        return { ...base, passage: obj.passage, observation: snip(obj.observation) };
    case 'dreams':       return { ...base, title: obj.title, type: obj.type, snippet: snip(obj.body) };
    case 'testimonies':  return { ...base, title: obj.title, snippet: snip(obj.body) };
    case 'blogs':        return { ...base, title: obj.title, status: obj.status, snippet: snip(obj.hook || obj.seedText) };
    case 'projects':     return { ...base, title: obj.title, phase: obj.phase, venture: obj.venture };
    case 'plans':        return { ...base, title: obj.title, venture: obj.venture, phase: obj.phase };
    case 'people':       return { ...base, name: obj.name, note: snip(obj.note) };
    case 'books':        return { ...base, title: obj.title, author: obj.author, status: obj.status };
    case 'daily':        return { ...base, date: obj.date, mood: obj.mood, snippet: snip(obj.oneSentence || obj.freeform) };
    case 'transactions': return { ...base, direction: obj.direction, amount: obj.amountGhs, category: obj.category, venture: obj.venture, memo: obj.memo };
    case 'events':       return { ...base, title: obj.title, startAt: obj.startAt };
    case 'fasts':        return { ...base, type: obj.type, purpose: obj.purpose, startedAt: obj.startedAt, endedAt: obj.endedAt };
    case 'meals':        return { ...base, date: obj.date, slot: obj.slot, items: obj.actualItems };
    case 'music':        return { ...base, title: obj.title, artist: obj.artist };
    default:             return { ...base, raw: snip(JSON.stringify(obj)) };
  }
}

function snip(s, n = 140) {
  if (!s) return '';
  const str = String(s);
  return str.length > n ? str.slice(0, n) + '…' : str;
}
