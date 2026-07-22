// Generic entry drawer. Slides from right.
// Pass { store, id } to openDrawer — renders editable fields per FIELDS[store].

import { get, put, del, all } from './store.js';
import {
  TASK_CONTEXTS, TASK_PRIORITIES, PLAN_PHASES, PROJECT_PHASES,
  EVENT_TYPES, VENTURES, PRAYER_TYPES, PRAYER_ANSWERS, FAST_TYPES,
  TX_ACCOUNTS, TX_CATEGORIES, BIBLE_BOOKS, BOOK_FORMATS, BOOK_STATUSES,
  QUIZ_TYPES, BLOG_STATUSES, PROPHECY_PLATFORMS, PROPHECY_STATUSES,
  shortId, formatAgo,
} from './domain.js';
import { isLocked, requestUnlock, toggleEntryLock, hasPin, isVaultUnlocked } from './lock.js';
import { renderAttachmentStrip } from './attach.js';

import { esc } from './util/esc.js';
import { formatList, toList } from './util/list.js';
let root, current = null;
const pendingCommits = new Set();

const commaListField = (key, label) => ({
  key,
  type: 'text',
  label,
  format: formatList,
  parse: toList,
});

const FIELDS = {
  ideas: [
    { key: 'title',  type: 'text' },
    { key: 'body',   type: 'textarea' },
    { key: 'status', type: 'select', options: ['active', 'dormant', 'archived', 'promoted'] },
    { key: 'weight', type: 'number', min: 0, max: 100 },
  ],
  tasks: [
    { key: 'title',        type: 'text' },
    { key: 'priority',     type: 'select', options: TASK_PRIORITIES },
    { key: 'context',      type: 'select', options: TASK_CONTEXTS },
    { key: 'scheduledFor', type: 'date', label: 'scheduled for' },
    { key: 'estMinutes',   type: 'number', label: 'estimate (min)' },
    { key: 'linkedTo',     type: 'text', label: 'linked to (id)' },
  ],
  projects: [
    { key: 'title',      type: 'text' },
    { key: 'phase',      type: 'select', options: PROJECT_PHASES },
    { key: 'parentPlan', type: 'text', label: 'parent plan (id)' },
    { key: 'startedOn',  type: 'date', label: 'started' },
    { key: 'due',        type: 'date' },
    { key: 'body',       type: 'textarea', label: 'notes' },
  ],
  plans: [
    { key: 'venture',       type: 'select', options: VENTURES },
    { key: 'title',         type: 'text' },
    { key: 'phase',         type: 'select', options: PLAN_PHASES },
    { key: 'thesis',        type: 'textarea' },
    { key: 'capitalNeed',   type: 'number', label: 'capital need (GHS)' },
    { key: 'capitalSource', type: 'text',   label: 'capital source' },
    { key: 'revenueModel',  type: 'text',   label: 'revenue model' },
    { key: 'tithePolicy',   type: 'text',   label: 'tithe policy' },
  ],
  events: [
    { key: 'title',        type: 'text' },
    { key: 'type',         type: 'select', options: EVENT_TYPES },
    { key: 'startAt',      type: 'datetime', label: 'start' },
    { key: 'endAt',        type: 'datetime', label: 'end' },
    { key: 'location',     type: 'text' },
    { key: 'prepNotes',    type: 'textarea', label: 'prep' },
    { key: 'debriefNotes', type: 'textarea', label: 'debrief' },
  ],
  prophecies: [
    { key: 'word',          type: 'textarea', label: 'word received' },
    { key: 'speaker',       type: 'text',     label: 'speaker / source' },
    { key: 'platform',      type: 'select',   options: PROPHECY_PLATFORMS },
    { key: 'dateReceived',  type: 'date',     label: 'date received' },
    { key: 'scripture',     type: 'text',     label: 'supporting scripture' },
    { key: 'theme',         type: 'text',     label: 'theme (e.g. family, business, healing)' },
    { key: 'status',        type: 'select',   options: PROPHECY_STATUSES },
    { key: 'fulfilledOn',   type: 'date',     label: 'fulfilled on' },
    { key: 'fulfillmentNotes', type: 'textarea', label: 'fulfillment notes' },
    { key: 'linkedTo',      type: 'text',     label: 'linked to (id)' },
  ],
  prayers: [
    { key: 'subject',    type: 'text' },
    { key: 'type',       type: 'select', options: PRAYER_TYPES },
    { key: 'intensity',  type: 'number', min: 1, max: 5 },
    { key: 'scripture',  type: 'text' },
    { key: 'cadence',    type: 'select', options: ['daily', 'weekly', 'seasonal', 'one-off'] },
    { key: 'startedOn',  type: 'date',   label: 'started' },
    { key: 'answer',     type: 'select', options: PRAYER_ANSWERS },
    { key: 'answeredOn', type: 'date',   label: 'answered on' },
    { key: 'answerNote', type: 'textarea', label: 'answer note' },
    { key: 'linkedTo',   type: 'text',   label: 'linked to (id)' },
  ],
  fasts: [
    { key: 'type',          type: 'select', options: FAST_TYPES },
    { key: 'purpose',       type: 'text' },
    { key: 'scripture',     type: 'text' },
    { key: 'startedAt',     type: 'datetime', label: 'started' },
    { key: 'plannedEndAt',  type: 'datetime', label: 'planned end' },
    { key: 'endedAt',       type: 'datetime', label: 'ended' },
    { key: 'breakingMeal',  type: 'text',     label: 'breaking meal' },
    { key: 'reflection',    type: 'textarea' },
    { key: 'linkedTo',      type: 'text',     label: 'linked to (id)' },
  ],
  bible: [
    { key: 'passage',         type: 'text', label: 'passage (e.g. Romans 8:28)' },
    { key: 'passageBook',     type: 'select', options: BIBLE_BOOKS, label: 'book' },
    { key: 'translation',     type: 'select', options: ['NIV','KJV','MSG','AMP','ESV','NLT','NKJV'] },
    { key: 'observation',     type: 'textarea', label: 'observation — what it says' },
    { key: 'interpretation',  type: 'textarea', label: 'interpretation — what it means' },
    { key: 'application',     type: 'textarea', label: 'application — what i’ll do' },
    { key: 'notes',           type: 'textarea', label: 'general notes' },
    { key: 'prayer',          type: 'textarea' },
    { key: 'mastery',         type: 'number', min: 0, max: 5, label: 'mastery (0-5)' },
  ],
  dreams: [
    { key: 'title',       type: 'text' },
    { key: 'type',        type: 'select', options: ['nightDream', 'vision', 'prophetic', 'aspirational'] },
    { key: 'dreamDate',   type: 'date',   label: 'dream date' },
    { key: 'emotion',     type: 'select', options: ['peace', 'fear', 'joy', 'conviction', 'confusion', 'awe'] },
    { key: 'body',        type: 'textarea', label: 'narrative' },
    commaListField('symbols', 'symbols (comma-sep)'),
    { key: 'scripture',   type: 'text' },
    { key: 'fulfilledOn', type: 'date',   label: 'fulfilled on' },
    { key: 'fulfilledBy', type: 'text',   label: 'fulfilled by (id)' },
  ],
  meals: [
    { key: 'date',         type: 'date' },
    { key: 'slot',         type: 'select', options: ['breakfast','midmorning','lunch','teatime','dinner','latenight'] },
    commaListField('plannedItems', 'planned (comma-sep)'),
    commaListField('actualItems', 'actual (comma-sep)'),
    { key: 'costGhs',      type: 'number', label: 'cost (GHS)' },
    { key: 'source',       type: 'select', options: ['home','cafeteria','restaurant','street','delivery'] },
    { key: 'homeCooked',   type: 'select', options: ['no','yes'] },
    { key: 'protein',      type: 'select', options: ['no','yes'] },
    { key: 'veg',          type: 'select', options: ['no','yes'] },
    { key: 'feltAfter',    type: 'select', options: ['energized','neutral','sluggish','sick'] },
    { key: 'forEvent',     type: 'text',   label: 'for event (id)' },
  ],
  books: [
    { key: 'title',           type: 'text' },
    { key: 'author',          type: 'text' },
    { key: 'format',          type: 'select', options: BOOK_FORMATS },
    { key: 'status',          type: 'select', options: BOOK_STATUSES },
    { key: 'startedOn',       type: 'date',   label: 'started' },
    { key: 'finishedOn',      type: 'date',   label: 'finished' },
    { key: 'currentLocation', type: 'text',   label: 'current location (e.g. ch 4, p 87)' },
    { key: 'summary',         type: 'textarea' },
    { key: 'keyIdeas',        type: 'textarea', label: 'key ideas (one per line)' },
    commaListField('themes', 'themes (comma-sep)'),
    { key: 'notes',           type: 'textarea' },
    { key: 'source',          type: 'text',   label: 'where you found it' },
    { key: 'rating',          type: 'number', min: 0, max: 5 },
    { key: 'mastery',         type: 'number', min: 0, max: 5 },
    { key: 'aiResearched',    type: 'select', options: ['no','yes'], label: 'AI-enriched' },
  ],
  quizzes: [
    { key: 'question',     type: 'textarea' },
    { key: 'type',         type: 'select', options: QUIZ_TYPES },
    { key: 'choices',      type: 'textarea', label: 'choices (one per line, MC only)' },
    { key: 'answer',       type: 'textarea' },
    { key: 'sourceLabel',  type: 'text', label: 'source label' },
    { key: 'sourceStore',  type: 'text', label: 'source store' },
    { key: 'sourceId',     type: 'text', label: 'source id' },
    { key: 'level',        type: 'number', min: 0, max: 7, label: 'SR level' },
    { key: 'nextDueAt',    type: 'datetime', label: 'next due' },
    { key: 'status',       type: 'select', options: ['due','reviewing','mastered','archived'] },
  ],
  blogs: [
    { key: 'title',        type: 'text' },
    { key: 'hook',         type: 'text',     label: 'hook (first 1-2 lines)' },
    { key: 'status',       type: 'select',   options: BLOG_STATUSES },
    commaListField('topics', 'topics (comma-sep)'),
    { key: 'series',       type: 'text' },
    { key: 'cta',          type: 'text',     label: 'call to action' },
    commaListField('scriptureRefs', 'scripture refs (comma-sep)'),
    { key: 'seedText',     type: 'textarea', label: 'seed (raw thought)' },
    { key: 'longForm',     type: 'textarea', label: 'master (long-form)' },
    { key: 'voiceProfile', type: 'text',     label: 'voice profile id' },
    { key: 'linkedTo',     type: 'text',     label: 'origin (idea/plan/dream id)' },
  ],
  voiceProfiles: [
    { key: 'name',          type: 'text' },
    { key: 'active',        type: 'select', options: ['no','yes'] },
    commaListField('tone', 'tone (comma-sep)'),
    { key: 'formality',     type: 'select',   options: ['low','medium-low','medium','medium-high','high'] },
    { key: 'sentencePat',   type: 'textarea', label: 'sentence patterns' },
    { key: 'vocabPrefer',   type: 'textarea', label: 'words to favor (one per line)' },
    { key: 'vocabAvoid',    type: 'textarea', label: 'words to avoid (one per line)' },
    { key: 'ghanaPhrases',  type: 'textarea', label: 'ghanaian phrases (opt-in, one per line)' },
    { key: 'pacing',        type: 'textarea' },
    { key: 'scripture',     type: 'textarea', label: 'scripture posture' },
    commaListField('audienceTilt', 'audiences (comma-sep)'),
    { key: 'samples',       type: 'textarea', label: 'training samples (--- separator)' },
  ],
  testimonies: [
    { key: 'title',  type: 'text' },
    { key: 'body',   type: 'textarea', label: 'what God did' },
    { key: 'date',   type: 'date' },
    { key: 'scripture', type: 'text' },
    { key: 'status', type: 'select', options: ['active', 'archived'] },
    { key: 'linkedTo', type: 'text', label: 'linked to (id)' },
  ],
  music: [
    { key: 'title',   type: 'text' },
    { key: 'artist',  type: 'text' },
    { key: 'heard',   type: 'text',     label: 'context (where/when heard)' },
    { key: 'date',    type: 'date' },
    { key: 'lyric',   type: 'textarea', label: 'lyric line(s) that hit' },
    { key: 'url',     type: 'text' },
  ],
  people: [
    { key: 'name',          type: 'text' },
    { key: 'role',          type: 'text', label: 'role / how you know them' },
    { key: 'note',          type: 'textarea' },
    commaListField('tags', 'tags (comma-sep)'),
    { key: 'lastTouchedAt', type: 'date',     label: 'last touched' },
    { key: 'phone',         type: 'text' },
    { key: 'email',         type: 'text' },
    { key: 'pray',          type: 'select',   options: ['no','yes'], label: 'praying for them' },
  ],
  transactions: [
    { key: 'date',       type: 'date' },
    { key: 'direction',  type: 'select', options: ['out', 'in'] },
    { key: 'amountGhs',  type: 'number', label: 'amount (GHS)' },
    { key: 'category',   type: 'select', options: TX_CATEGORIES },
    { key: 'account',    type: 'select', options: TX_ACCOUNTS },
    { key: 'payee',      type: 'text' },
    { key: 'memo',       type: 'textarea' },
    { key: 'venture',    type: 'select', options: VENTURES },
    { key: 'tithe',      type: 'select', options: ['no', 'yes'] },
    { key: 'reconciledOn', type: 'date', label: 'reconciled' },
    { key: 'linkedTo',   type: 'text',  label: 'linked to (id)' },
  ],
};

export function mountDrawer(el) {
  root = el;
  root.innerHTML = `
    <div class="drawer-overlay" id="dr-ov"></div>
    <aside class="drawer" id="dr-panel" aria-hidden="true">
      <div class="drawer-head">
        <span class="drawer-domain" id="dr-domain"></span>
        <span class="drawer-id mono" id="dr-id"></span>
        <button class="lock-toggle" id="dr-lock" type="button" title="lock entry" aria-label="lock entry">🔓</button>
        <button class="drawer-close" id="dr-close" title="close (esc)">×</button>
      </div>
      <div class="drawer-body" id="dr-body"></div>
      <div class="drawer-foot">
        <span class="meta" id="dr-meta"></span>
        <div class="drawer-actions">
          <button class="btn is-danger" id="dr-del">move to trash</button>
          <button class="btn is-primary" id="dr-save">save & close</button>
        </div>
      </div>
    </aside>
  `;

  root.querySelector('#dr-close').addEventListener('click', () => closeDrawer());
  root.querySelector('#dr-ov').addEventListener('click', () => closeDrawer());
  root.querySelector('#dr-lock').addEventListener('click', async () => {
    if (!current) return;
    const fresh = await get(current.store, current.id);
    if (!fresh) return;
    const willLock = !fresh.locked;
    // First lock ever → run the PIN setup flow before flipping the flag
    if (willLock && !(await hasPin())) {
      const ok = await requestUnlock('set up a vault PIN to lock entries');
      if (!ok) return;
    }
    const next = toggleEntryLock(fresh);
    await put(current.store, next);
    current.entry = next;
    paintLockButton(next.locked);
  });
  root.querySelector('#dr-del').addEventListener('click', async () => {
    if (!current) return;
    if (!confirm('move this entry to trash? you can restore it for 30 days.')) return;
    await flushPendingEdits();
    await del(current.store, current.id);
    current.committed = true;
    closeDrawer();
  });
  root.querySelector('#dr-save').addEventListener('click', async () => {
    if (!current) return closeDrawer();
    await flushPendingEdits();
    // Persist a touch to refresh updatedAt
    const fresh = await get(current.store, current.id);
    if (fresh) {
      delete fresh._draft;
      delete fresh._draftCreatedAt;
      await put(current.store, fresh);
      current.entry = fresh;
      current.committed = true;
      try {
        const { updateStreak } = await import('./rewards.js');
        updateStreak(domainKeyForStore(current.store));
      } catch { /* ignore */ }
    }
    flashSaveSuccess(root.querySelector('#dr-meta'));
    setTimeout(closeDrawer, 700);
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOpen()) closeDrawer();
  });
}

export async function openDrawer(store, id) {
  if (!root) return;
  const entry = await get(store, id);
  if (!entry) return;

  // Vault gate — locked entries require unlock before editing
  if (isLocked(entry)) {
    const ok = await requestUnlock(`unlock ${store} entry to view`);
    if (!ok) return;
  }

  current = { store, id, entry, committed: !entry._draft };

  root.querySelector('#dr-domain').textContent = store;
  root.querySelector('#dr-id').textContent     = shortId(id);
  root.querySelector('#dr-meta').textContent   = `updated ${formatAgo(entry.updatedAt)}`;
  paintLockButton(!!entry.locked);

  const body = root.querySelector('#dr-body');
  body.innerHTML = '';

  const fields = FIELDS[store] || [{ key: 'title', type: 'text' }];
  for (const f of fields) {
    body.appendChild(renderField(f, entry[f.key], async v => {
      const fresh = await get(store, id);
      if (!fresh) return;
      fresh[f.key] = v;
      await put(store, fresh);
      current.entry = fresh;
      const meta = root.querySelector('#dr-meta');
      meta.textContent = 'updated just now';
      flashSaveSuccess(meta);
    }));
  }

  // Attachments — every entry can hold up to 6 images
  const attachSection = document.createElement('div');
  attachSection.className = 'drawer-section';
  attachSection.innerHTML = `<div class="drawer-section-title">attachments</div><div id="dr-attach"></div>`;
  body.appendChild(attachSection);
  renderAttachmentStrip(attachSection.querySelector('#dr-attach'), entry.attachments || [], {
    onChange: async (next) => {
      const fresh = await get(store, id);
      if (!fresh) return;
      fresh.attachments = next;
      await put(store, fresh);
      current.entry = fresh;
    },
  });

  // Linked section
  const links = await findLinks(entry, store);
  if (links.length) {
    const section = document.createElement('div');
    section.className = 'drawer-section';
    section.innerHTML = `<div class="drawer-section-title">linked</div>`;
    for (const l of links) {
      const row = document.createElement('div');
      row.className = 'drawer-link-row';
      row.innerHTML = `
        <span class="dot emerald"></span>
        <span>${esc(l.title || l.venture || shortId(l.id))}</span>
        <span class="meta">${l.store} · ${shortId(l.id)}</span>
      `;
      row.addEventListener('click', () => openDrawer(l.store, l.id));
      section.appendChild(row);
    }
    body.appendChild(section);
  }

  root.querySelector('#dr-panel').setAttribute('aria-hidden', 'false');
  root.querySelector('#dr-ov').classList.add('is-open');
}

export async function closeDrawer() {
  if (!root) return;
  const closing = current;
  if (closing?.entry?._draft && !closing.committed) {
    try {
      await flushPendingEdits();
      await del(closing.store, closing.id, { reason: 'discarded draft' });
    } catch (err) {
      console.warn('draft discard failed', err);
    }
  }
  root.querySelector('#dr-panel').setAttribute('aria-hidden', 'true');
  root.querySelector('#dr-ov').classList.remove('is-open');
  current = null;
  window.dispatchEvent(new CustomEvent('drawer:close'));
}

async function flushPendingEdits() {
  const focused = root?.querySelector('#dr-body input:focus, #dr-body textarea:focus, #dr-body select:focus');
  focused?.blur();
  if (pendingCommits.size) await Promise.allSettled([...pendingCommits]);
}

function isOpen() {
  return root?.querySelector('#dr-panel')?.getAttribute('aria-hidden') === 'false';
}

function paintLockButton(locked) {
  const btn = root?.querySelector('#dr-lock');
  if (!btn) return;
  btn.textContent = locked ? '🔒' : '🔓';
  btn.classList.toggle('is-on', !!locked);
  btn.title = locked ? 'unlock entry' : 'lock entry';
  btn.setAttribute('aria-label', btn.title);
}

// Re-lock the drawer if the user manually locks the vault (e.g. via topbar)
window.addEventListener('vault:locked', () => {
  if (current?.entry?.locked) closeDrawer();
});

function renderField(field, value, onCommit) {
  const wrap  = document.createElement('div');
  wrap.className = 'drawer-field';
  const label = field.label || field.key;
  const displayValue = field.format ? field.format(value) : value;

  let html = `<label class="drawer-label">${label}</label>`;

  if (field.type === 'text') {
    html += `<input type="text" value="${esc(displayValue)}">`;
  } else if (field.type === 'textarea') {
    html += `<textarea>${esc(displayValue)}</textarea>`;
  } else if (field.type === 'number') {
    html += `<input type="number" value="${displayValue ?? ''}"${field.min !== undefined ? ` min="${field.min}"` : ''}${field.max !== undefined ? ` max="${field.max}"` : ''}>`;
  } else if (field.type === 'date') {
    html += `<input type="date" value="${displayValue || ''}">`;
  } else if (field.type === 'datetime') {
    const v = displayValue ? new Date(displayValue).toISOString().slice(0, 16) : '';
    html += `<input type="datetime-local" value="${v}">`;
  } else if (field.type === 'select') {
    html += `<select>${(displayValue ? [''] : []).concat(field.options).map(o =>
      `<option value="${o}"${o === (displayValue || '') ? ' selected' : ''}>${o || '—'}</option>`).join('')}</select>`;
  }

  wrap.innerHTML = html;
  const el = wrap.querySelector('input, textarea, select');
  if (!el) return wrap;

  const evt = field.type === 'select' || field.type === 'date' || field.type === 'datetime' ? 'change' : 'blur';
  el.addEventListener(evt, e => {
    let v = e.target.value;
    if (field.type === 'number')   v = v === '' ? null : Number(v);
    if (field.type === 'datetime') v = v ? new Date(v).toISOString() : null;
    if (field.parse) v = field.parse(v);
    const commit = Promise.resolve(onCommit(v))
      .catch(err => console.error('drawer field save failed', err))
      .finally(() => pendingCommits.delete(commit));
    pendingCommits.add(commit);
  });
  return wrap;
}

async function findLinks(entry, store) {
  const out = [];

  // Forward hard links
  if (entry.parentPlan) {
    const p = await get('plans', entry.parentPlan);
    if (p) out.push({ ...p, store: 'plans' });
  }
  if (entry.linkedTo) {
    for (const s of ['projects', 'plans', 'events', 'tasks', 'ideas']) {
      const e = await get(s, entry.linkedTo);
      if (e) { out.push({ ...e, store: s }); break; }
    }
  }

  // Reverse hard links
  if (store === 'plans') {
    (await all('projects')).forEach(p => { if (p.parentPlan === entry.id) out.push({ ...p, store: 'projects' }); });
  }
  if (store === 'projects') {
    (await all('tasks')).forEach(t => { if (t.linkedTo === entry.id) out.push({ ...t, store: 'tasks' }); });
  }

  return out;
}

function flashSaveSuccess(metaEl) {
  if (!metaEl) return;
  const existing = metaEl.parentElement.querySelector('.save-success');
  if (existing) existing.remove();
  const ok = document.createElement('span');
  ok.className = 'save-success';
  ok.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> saved`;
  metaEl.parentElement.insertBefore(ok, metaEl);
  setTimeout(() => ok.remove(), 1400);
}

const STORE_TO_DOMAIN = {
  daily: 'daily', dreams: 'dreams', ideas: 'ideas', bible: 'bible',
  prayers: 'prayer', fasts: 'fasting', plans: 'plans', projects: 'projects',
  tasks: 'tasks', events: 'schedule', meals: 'meals', transactions: 'finance',
  blogs: 'blog', testimonies: 'testimony', music: 'music', people: 'people',
  books: 'books', quizzes: 'quizzes',
};
function domainKeyForStore(s) { return STORE_TO_DOMAIN[s] || s; }
