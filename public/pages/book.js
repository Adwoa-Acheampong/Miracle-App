// Hobonichi Book View — ONE DAY = ONE SPREAD (both pages).
// Left = morning/structural · Right = creative/reflective.
// 3D page flip on ±1 day nav.

import { all, get, put } from '../store.js';
import { verseForDate } from '../scripture.js';
import { navigate } from '../router.js';
import { moodInfo } from '../mood.js';

import { esc } from '../util/esc.js';
let view = 'spread';
let dateStr = new Date().toISOString().slice(0, 10);
let opening = true;

// ═══ INLINE SVG ICON SET ═══

const ICONS = {
  oneLine:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  gratitude: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  tasks:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><polyline points="9 12 11 14 15 10"/></svg>`,
  schedule:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>`,
  prayer:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M5 9h14"/></svg>`,
  canvas:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3l5 5L8 21H3v-5z"/><path d="M14 5l5 5"/></svg>`,
  ideas:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/></svg>`,
  fasting:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
  testimony: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 14.5 8.5 21 9.3 16 14 17.2 21 12 17.8 6.8 21 8 14 3 9.3 9.5 8.5"/></svg>`,
  tickEmpty: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`,
  tickDone:  `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><polyline points="8 12 11 15 16 9"/></svg>`,
};

const PRAYER_TYPE_ICON = {
  intercession: '✝',
  supplication: '✛',
  thanksgiving: '✦',
  worship: '✶',
  confession: '○',
};

export async function render() {
  const root = document.createElement('div');
  root.className = 'page page-wide';
  root.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">book</h1>
      <span class="page-meta">hobonichi · one day · twin-page spread</span>
    </div>

    <div class="book-switch">
      <button class="btn ${view === 'spread' ? 'is-primary' : ''}" data-view="spread">day spread</button>
      <button class="btn ${view === 'year' ? 'is-primary' : ''}" data-view="year">year · leaf through</button>
    </div>

    <div id="book-body"></div>
  `;

  const body = root.querySelector('#book-body');
  await paint(body, root);

  root.querySelectorAll('[data-view]').forEach(b => {
    b.addEventListener('click', async () => {
      view = b.dataset.view;
      root.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('is-primary', x === b));
      opening = view === 'spread' && opening;
      await paint(body, root);
    });
  });

  return root;
}
async function paint(body, root) {
  if (view === 'spread') body.innerHTML = await renderSpread();
  else                    body.innerHTML = await renderYear();
  attach(body, root);
}

function shiftDate(str, delta) {
  const d = new Date(str + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

async function renderSpread() {
  const ds = dateStr;
  const data = await dayData(ds);
  const initialOpening = opening ? 'is-opening' : '';
  opening = false;

  const d = new Date(ds + 'T00:00:00');
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d - startOfYear) / 86400000) + 1;

  return `
    <div class="book-surface">
      <div class="book-container">
        <div class="book ${initialOpening}" id="book">
          <div class="book-spine" aria-hidden="true">
            <div class="spine-counter">DAY ${String(dayOfYear).padStart(3, '0')} / 365</div>
          </div>
          ${leftPageHtml(ds, data)}
          ${rightPageHtml(ds, data)}
          <div class="page-flipper" id="page-flipper" aria-hidden="true">
            <div class="page-flipper-front"></div>
            <div class="page-flipper-back"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="book-nav">
      <button class="book-nav-btn" data-shift="-1" aria-label="previous day">‹</button>
      <div class="book-progress">${ds}</div>
      <button class="btn book-edit-btn" data-edit-page="${ds}" type="button">edit page</button>
      <button class="book-nav-btn" data-shift="1" aria-label="next day">›</button>
    </div>
    ${bookToolsHtml(ds, data.page)}
  `;
}

async function dayData(d) {
  const page = (await get('daily', d)) || { date: d, oneSentence: '', gratitude: ['','',''], freeform: '' };
  const tasks = (await all('tasks')).filter(t => t.scheduledFor === d);
  const ideas = (await all('ideas')).filter(i => (i.updatedAt || '').startsWith(d));
  const testimonies = (await all('testimonies')).filter(t => t.date === d);
  const events = (await all('events')).filter(e => (e.startAt || '').startsWith(d));
  const prayers = (await all('prayers')).filter(p => {
    // Active if started on or before this date and not answered before this date
    const startOk = (p.startedOn || '') <= d;
    const notYet = !p.answeredOn || p.answeredOn >= d;
    return startOk && notYet && (!p.answer || p.answer === 'pending');
  });
  const fasts = (await all('fasts')).filter(f => {
    const start = (f.startedAt || '').slice(0, 10);
    const end   = (f.endedAt   || '').slice(0, 10);
    return start <= d && (!end || end >= d);
  });
  const verse = verseForDate(d);
  return { page, tasks, ideas, testimonies, events, prayers, fasts, verse };
}

// ═══ LEFT PAGE ═══

function leftPageHtml(ds, data) {
  const { page, tasks, events, prayers, verse } = data;
  const d = new Date(ds + 'T00:00:00');
  const dayNum = d.getDate();
  const monthName = d.toLocaleDateString(undefined, { month: 'long' }).toLowerCase();
  const weekday   = d.toLocaleDateString(undefined, { weekday: 'long' }).toLowerCase();
  const monthAbbr = d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  const dow       = d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  const yr        = d.getFullYear();

  // Render mini month-calendar SVG
  const calSvg = miniMonth(d);

  return `
    <div class="book-page left" data-date="${ds}">
      <div class="book-page-face front">
        <div class="page-paper">
          ${bookEffectsHtml(data, 'left')}
          <div class="page-corner-grid">${calSvg}</div>

          <div class="bp-corner">${monthAbbr} · ${dow} · ${yr}</div>
          <div class="bp-date-block">
            <div class="bp-date">${dayNum}<span class="bp-weekday">${weekday}</span></div>
          </div>
          <div class="bp-date-rule"></div>

          ${section('one line', ICONS.oneLine)}
          <div class="rule-line ${page.oneSentence ? '' : 'is-empty'}">${esc(page.oneSentence) || '<span class="dim">—</span>'}</div>
          <div class="rule-line"></div>

          ${section('gratitude · 3', ICONS.gratitude)}
          ${(page.gratitude || ['','','']).map(g => `
            <div class="rule-line">${esc(g) || '<span class="dim">·</span>'}</div>
          `).join('')}
          <div class="rule-line"></div>

          ${section('tasks', ICONS.tasks)}
          ${tasks.length === 0
            ? `<div class="rule-line"><span class="dim">—</span></div><div class="rule-line"></div><div class="rule-line"></div>`
            : tasks.slice(0, 6).map(t => `
                <div class="rule-line task-line">
                  <span class="task-tick">${t.completedAt ? ICONS.tickDone : ICONS.tickEmpty}</span>
                  <span class="task-title ${t.completedAt ? 'is-done' : ''}">${esc(t.title)}</span>
                  ${t.priority ? `<span class="task-prio">${esc(t.priority)}</span>` : ''}
                </div>
              `).join('')}

          ${section('schedule', ICONS.schedule)}
          ${events.length === 0
            ? `<div class="rule-line"><span class="dim">—</span></div><div class="rule-line"></div>`
            : events.slice(0, 4).map(e => `
                <div class="rule-line sched-line">
                  <span class="sched-time">${esc(timeStr(e.startAt))}</span>
                  <span class="sched-title">${esc(e.title || '')}</span>
                </div>
              `).join('')}

          ${section('prayer', ICONS.prayer)}
          ${prayers.length === 0
            ? `<div class="rule-line"><span class="dim">—</span></div>`
            : prayers.slice(0, 4).map(p => `
                <div class="rule-line prayer-line">
                  <span class="prayer-type">${PRAYER_TYPE_ICON[p.type] || '✛'}</span>
                  <span class="prayer-subject">${esc(p.subject || '')}</span>
                  <span class="prayer-cadence">${esc(p.cadence || '')}</span>
                </div>
              `).join('') + (prayers.length > 4 ? `<div class="rule-line"><span class="dim">+${prayers.length - 4} more</span></div>` : '')}

          <div class="bp-quote">"${esc(verse.text)}" — ${esc(verse.ref)}</div>
        </div>
        <div class="page-edge-shadow"></div>
        <div class="corner-curl" aria-hidden="true"></div>
      </div>
    </div>
  `;
}

// ═══ RIGHT PAGE ═══

function rightPageHtml(ds, data) {
  const { page, ideas, testimonies, fasts, verse } = data;
  const d = new Date(ds + 'T00:00:00');
  const dayNum = d.getDate();
  const monthName = d.toLocaleDateString(undefined, { month: 'long' }).toLowerCase();
  const weekday   = d.toLocaleDateString(undefined, { weekday: 'long' }).toLowerCase();
  const monthAbbr = d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  const dow       = d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  const yr        = d.getFullYear();

  const habitGrid = habitGridSvg();
  const canvasLines = (page.freeform || '').split('\n');
  while (canvasLines.length < 5) canvasLines.push('');

  return `
    <div class="book-page right" data-date="${ds}">
      <div class="book-page-face front">
        <div class="page-paper">
          ${bookEffectsHtml(data, 'right')}
          <div class="page-corner-habit">${habitGrid}</div>

          <div class="bp-corner right-align">${yr} · ${dow} · ${monthAbbr}</div>
          <div class="bp-date-block right-align">
            <div class="bp-date">${dayNum}<span class="bp-weekday">${weekday}</span></div>
          </div>
          <div class="bp-date-rule"></div>

          ${section('canvas', ICONS.canvas)}
          ${canvasLines.slice(0, 8).map(line => `
            <div class="rule-line ${line ? '' : 'is-empty'}">${esc(line) || '<span class="dim">·</span>'}</div>
          `).join('')}

          ${section('ideas captured', ICONS.ideas)}
          ${ideas.length === 0
            ? `<div class="rule-line"><span class="dim">—</span></div><div class="rule-line"></div>`
            : ideas.slice(0, 4).map(i => `
                <div class="rule-line idea-line">
                  <span class="idea-bullet">✦</span>
                  <span class="idea-title">${esc(i.title || '')}</span>
                </div>
              `).join('')}

          ${section('fasting', ICONS.fasting)}
          ${fasts.length === 0
            ? `<div class="rule-line"><span class="dim">—</span></div>`
            : fasts.slice(0, 2).map(f => {
                const hrs = f.startedAt
                  ? Math.round((new Date(f.endedAt || Date.now()) - new Date(f.startedAt)) / 3600000)
                  : 0;
                return `
                  <div class="rule-line fast-line">
                    <span class="fast-flame">◎</span>
                    <span class="fast-type">${esc(f.type || '')}</span>
                    <span class="fast-meta">${hrs}h · ${esc(f.endedAt ? 'closed' : 'active')}</span>
                  </div>
                `;
              }).join('')}

          ${section('testimony', ICONS.testimony)}
          ${testimonies.length === 0
            ? `<div class="rule-line"><span class="dim">—</span></div><div class="rule-line"></div><div class="rule-line"></div>`
            : testimonies.slice(0, 3).map(t => `
                <div class="rule-line italic">${esc(t.title || t.body || '')}</div>
              `).join('')}

          <div class="bp-quote">"${esc(verse.text)}" — ${esc(verse.ref)}</div>
        </div>
        <div class="page-edge-shadow"></div>
        <div class="corner-curl" aria-hidden="true"></div>
      </div>
    </div>
  `;
}

function section(label, iconSvg) {
  return `<div class="rule-line section-row"><span class="section-icon">${iconSvg}</span><span class="section-label">${label}</span><span class="section-bar"></span></div>`;
}

function bookToolsHtml(ds, page) {
  const highlights = normalizeMarks(page.bookHighlights);
  const stickers = normalizeMarks(page.bookStickers);
  const emojis = normalizeMarks(page.bookEmojiStamps);
  const total = highlights.length + stickers.length + emojis.length;
  const emojiChoices = ['✨', '🙏', '💛', '🔥', '🌱', '🕊️'];
  return `
    <section class="book-tools" data-book-tools="${esc(ds)}">
      <div class="book-tools-head">
        <div>
          <span>page marks</span>
          <small>${total ? `${total} saved mark${total === 1 ? '' : 's'}` : 'highlight, sticker, or emoji this spread'}</small>
        </div>
        <button class="btn book-tool-edit-text" data-edit-page="${esc(ds)}" type="button">edit text</button>
      </div>
      <div class="book-tool-grid">
        <label class="book-tool-field">
          <span>highlight text</span>
          <input class="book-tool-highlight" type="text" placeholder="phrase to highlight or remember">
        </label>
        <label class="book-tool-field">
          <span>sticker note</span>
          <textarea class="book-tool-sticker" rows="2" placeholder="short note for the page"></textarea>
        </label>
        <div class="book-tool-field">
          <span>emoji stamp</span>
          <div class="book-emoji-picks">
            ${emojiChoices.map(e => `<button type="button" data-book-emoji="${esc(e)}">${esc(e)}</button>`).join('')}
          </div>
        </div>
      </div>
      ${total ? `
        <div class="book-tool-preview">
          ${highlights.slice(-2).map(m => `<span class="book-preview-highlight">${esc(m.text)}</span>`).join('')}
          ${stickers.slice(-2).map(m => `<span class="book-preview-sticker">${esc(m.text)}</span>`).join('')}
          ${emojis.slice(-3).map(m => `<span class="book-preview-emoji">${esc(m.emoji || m.text)}</span>`).join('')}
        </div>
      ` : ''}
      <div class="book-tool-actions">
        <span class="book-tool-status meta"></span>
        <button class="btn book-tool-clear" type="button">clear marks</button>
        <button class="btn is-primary book-tool-save" type="button">save marks</button>
      </div>
    </section>
  `;
}

// ═══ MICRO-GRAPHICS ═══

function bookEffectsHtml(data, side) {
  const { page, testimonies, fasts, ideas, events } = data;
  const effects = [];
  if (side === 'left' && page.mood) {
    const mood = moodInfo(page.mood);
    effects.push(`<span class="book-emoji-stamp" title="${esc(mood.label)}">${mood.emoji}</span>`);
  }
  if (side === 'left' && events.length) {
    effects.push(`<span class="book-highlight-strip" title="${esc(events.length + ' event(s) logged')}"></span>`);
  }
  if (side === 'right' && testimonies.length) {
    const note = (testimonies[0].title || testimonies[0].body || '').slice(0, 52);
    effects.push(`<div class="book-note-sticker"><strong>testimony</strong><span>${esc(note)}</span></div>`);
  }
  if (side === 'right' && fasts.length) {
    effects.push(`<span class="book-margin-mark" title="fast logged">fast</span>`);
  }
  if (side === 'right' && ideas.length) {
    effects.push(`<span class="book-spark-pin" title="${esc(ideas.length + ' idea(s)')}">+</span>`);
  }
  effects.push(...renderCustomBookMarks(page, side));
  return effects.join('');
}

function renderCustomBookMarks(page, side) {
  const out = [];
  const highlights = normalizeMarks(page.bookHighlights).slice(-3);
  const stickers = normalizeMarks(page.bookStickers).slice(-2);
  const emojis = normalizeMarks(page.bookEmojiStamps).slice(-4);

  highlights.forEach((mark, idx) => {
    const markSide = mark.side || (idx % 2 ? 'right' : 'left');
    if (markSide !== side) return;
    out.push(`<span class="book-user-highlight h${idx}" title="${esc(mark.text)}">${esc(mark.text)}</span>`);
  });

  stickers.forEach((mark, idx) => {
    const markSide = mark.side || 'right';
    if (markSide !== side) return;
    out.push(`<div class="book-user-sticker s${idx}"><strong>note</strong><span>${esc(mark.text)}</span></div>`);
  });

  emojis.forEach((mark, idx) => {
    const markSide = mark.side || (idx % 2 ? 'right' : 'left');
    if (markSide !== side) return;
    out.push(`<span class="book-user-emoji e${idx}" title="${esc(mark.label || 'emoji stamp')}">${esc(mark.emoji || mark.text)}</span>`);
  });

  return out;
}

function normalizeMarks(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function miniMonth(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const today = date.getDate();
  const first = new Date(y, m, 1);
  const startDow = (first.getDay() + 6) % 7; // Monday-first
  const days = new Date(y, m + 1, 0).getDate();
  // Two passes: circles first (background), text second (foreground)
  let circles = '';
  let texts = '';
  let row = 0, col = startDow;
  for (let d = 1; d <= days; d++) {
    const cx = 4 + col * 8;
    const cy = 4 + row * 8;
    const isToday = d === today;
    if (isToday) {
      circles += `<circle cx="${cx}" cy="${cy}" r="3.6" fill="#2A2620"/>`;
    }
    texts += `<text x="${cx}" y="${cy + 1.6}" text-anchor="middle" font-size="5" font-family="JetBrains Mono, monospace" fill="${isToday ? '#f5f0e8' : '#8a8275'}" font-weight="${isToday ? 600 : 400}">${d}</text>`;
    col++;
    if (col > 6) { col = 0; row++; }
  }
  return `
    <svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      ${circles}${texts}
    </svg>
  `;
}

function habitGridSvg() {
  let dots = '';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 7; c++) {
      dots += `<circle cx="${3 + c * 7}" cy="${3 + r * 7}" r="1.2" fill="#a3998a"/>`;
    }
  }
  return `<svg width="48" height="36" viewBox="0 0 48 36" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${dots}</svg>`;
}

// ═══ YEAR VIEW (unchanged shape, kept for /book year toggle) ═══

async function renderYear() {
  const year = new Date().getFullYear();
  const todayIso = new Date().toISOString().slice(0, 10);
  const currentIso = dateStr;

  // Build a Set of every date string with any record across all entry stores
  const STORES = ['daily', 'tasks', 'prayers', 'fasts', 'ideas', 'testimonies', 'events', 'meals', 'transactions', 'bible', 'dreams', 'projects', 'plans', 'books', 'music', 'people', 'quizzes', 'blogs'];
  const filled = new Set();
  for (const s of STORES) {
    try {
      const rows = await all(s);
      for (const r of rows) {
        const dt =
          r.date ||
          (r.scheduledFor) ||
          (r.startedOn) ||
          (r.dreamDate) ||
          (r.startedAt ? r.startedAt.slice(0, 10) : '') ||
          (r.startAt ? r.startAt.slice(0, 10) : '') ||
          (r.updatedAt ? r.updatedAt.slice(0, 10) : '') ||
          (r.createdAt ? r.createdAt.slice(0, 10) : '');
        if (dt) filled.add(dt);
      }
    } catch { /* skip */ }
  }

  const months = Array.from({ length: 12 }, (_, m) => {
    const first = new Date(year, m, 1);
    const startDow = (first.getDay() + 6) % 7;          // Monday-first offset
    const days = new Date(year, m + 1, 0).getDate();
    const monthName = first.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
    const fullName  = first.toLocaleDateString(undefined, { month: 'long' }).toLowerCase();
    const cells = [];
    // Leading blanks
    for (let i = 0; i < startDow; i++) cells.push({ empty: true });
    // Actual day cells
    for (let day = 1; day <= days; day++) {
      const iso = `${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        empty: false,
        day,
        iso,
        isToday: iso === todayIso,
        isCurrent: iso === currentIso,
        hasEntry: filled.has(iso),
      });
    }
    return { m, monthName, fullName, days, cells };
  });

  return `
    <div class="book-year">
      ${months.map(({ m, monthName, fullName, days, cells }) => `
        <div class="book-month" data-month="${m}" title="${fullName}">
          <div class="book-month-head">
            <span class="book-month-name">${monthName}</span>
            <span class="book-month-num">${String(m + 1).padStart(2, '0')}</span>
          </div>
          <div class="book-month-dow">
            <span>m</span><span>t</span><span>w</span><span>t</span><span>f</span><span>s</span><span>s</span>
          </div>
          <div class="book-month-days">
            ${cells.map(c => c.empty
              ? `<span class="book-month-day is-empty" aria-hidden="true"></span>`
              : `<span class="book-month-day${c.isToday ? ' is-today' : ''}${c.isCurrent ? ' is-current' : ''}${c.hasEntry ? ' has-entry' : ''}" data-date="${c.iso}" data-day="${c.day}" role="button" tabindex="0" aria-label="${c.iso}">${c.day}</span>`
            ).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function attach(body, root) {
  let isFlipping = false;
  body.querySelectorAll('[data-shift]').forEach(b => {
    b.addEventListener('click', async () => {
      if (isFlipping) return;
      const shift = Number(b.dataset.shift);
      const bookEl = body.querySelector('#book');
      if (!bookEl) {
        dateStr = shiftDate(dateStr, shift);
        await paint(body, root);
        return;
      }
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        dateStr = shiftDate(dateStr, shift);
        await paint(body, root);
        return;
      }

      isFlipping = true;
      bookEl.classList.add(shift > 0 ? 'is-flipping-next' : 'is-flipping-prev');
      await new Promise(r => setTimeout(r, 660));
      dateStr = shiftDate(dateStr, shift);
      await paint(body, root);
      isFlipping = false;
    });
  });

  body.querySelector('[data-edit-page]')?.addEventListener('click', e => {
    navigate(`/day/${e.currentTarget.dataset.editPage}`);
  });
  bindBookTools(body, root);

  // Mobile swipe
  let touchStartX = null;
  const stage = body.querySelector('.book-container');
  if (stage) {
    stage.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', async e => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) < 60) return;
      const btn = body.querySelector(`[data-shift="${dx < 0 ? 1 : -1}"]`);
      btn?.click();
    }, { passive: true });
  }

  body.querySelectorAll('[data-month]').forEach(b => {
    b.addEventListener('click', async e => {
      // Don't fire month-jump if a specific day was clicked
      if (e.target.closest('.book-month-day[data-date]')) return;
      const m = Number(b.dataset.month);
      const y = new Date().getFullYear();
      dateStr = new Date(y, m, 1).toISOString().slice(0, 10);
      view = 'spread';
      opening = true;
      root.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('is-primary', x.dataset.view === 'spread'));
      await paint(body, root);
      body.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // FIX: clicking a specific day cell navigates to that day's spread
  body.querySelectorAll('.book-month-day[data-date]').forEach(span => {
    const jump = async () => {
      const date = span.dataset.date;
      if (!date) return;
      dateStr = date;
      view = 'spread';
      opening = true;
      root.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('is-primary', x.dataset.view === 'spread'));
      await paint(body, root);
      body.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    span.addEventListener('click', e => { e.stopPropagation(); jump(); });
    span.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); jump(); }
    });
  });
}

function bindBookTools(body, root) {
  const tools = body.querySelector('[data-book-tools]');
  if (!tools) return;
  let selectedEmoji = '';

  tools.querySelectorAll('[data-book-emoji]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedEmoji = btn.dataset.bookEmoji || '';
      tools.querySelectorAll('[data-book-emoji]').forEach(x => x.classList.toggle('is-active', x === btn));
    });
  });

  tools.querySelectorAll('[data-edit-page]').forEach(btn => {
    btn.addEventListener('click', () => navigate(`/day/${btn.dataset.editPage}`));
  });

  tools.querySelector('.book-tool-save')?.addEventListener('click', async () => {
    const ds = tools.dataset.bookTools;
    const highlight = tools.querySelector('.book-tool-highlight')?.value.trim() || '';
    const sticker = tools.querySelector('.book-tool-sticker')?.value.trim() || '';
    const status = tools.querySelector('.book-tool-status');
    if (!highlight && !sticker && !selectedEmoji) {
      if (status) status.textContent = 'add a highlight, sticker, or emoji first';
      return;
    }

    const page = await get('daily', ds) || { date: ds, oneSentence: '', gratitude: ['', '', ''], freeform: '' };
    const next = {
      ...page,
      bookHighlights: normalizeMarks(page.bookHighlights),
      bookStickers: normalizeMarks(page.bookStickers),
      bookEmojiStamps: normalizeMarks(page.bookEmojiStamps),
    };
    const stamp = new Date().toISOString();
    if (highlight) next.bookHighlights = [...next.bookHighlights, { id: markId(), text: highlight, side: 'left', createdAt: stamp }].slice(-6);
    if (sticker) next.bookStickers = [...next.bookStickers, { id: markId(), text: sticker, side: 'right', createdAt: stamp }].slice(-5);
    if (selectedEmoji) next.bookEmojiStamps = [...next.bookEmojiStamps, { id: markId(), emoji: selectedEmoji, side: next.bookEmojiStamps.length % 2 ? 'right' : 'left', createdAt: stamp }].slice(-8);

    await put('daily', next);
    opening = false;
    await paint(body, root);
  });

  tools.querySelector('.book-tool-clear')?.addEventListener('click', async () => {
    const ds = tools.dataset.bookTools;
    const page = await get('daily', ds);
    if (!page) return;
    const next = { ...page, bookHighlights: [], bookStickers: [], bookEmojiStamps: [] };
    await put('daily', next);
    opening = false;
    await paint(body, root);
  });
}

function markId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function timeStr(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}
