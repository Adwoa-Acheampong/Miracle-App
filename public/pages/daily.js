import { get, put, all } from '../store.js';
import { SR_INTERVALS_DAYS } from '../domain.js';
import { verseForDate } from '../scripture.js';
import { renderMoodPicker } from '../mood.js';
import { micButton, attachDictation, VOICE_SUPPORTED } from '../voice.js';
import { renderAttachmentStrip } from '../attach.js';
import { isLocked, requestUnlock, toggleEntryLock, hasPin } from '../lock.js';

import { esc } from '../util/esc.js';
export async function render([dateStr]) {
  const date = dateStr;
  const page = normalizeDailyPage(date, await get('daily', date));
  const dailyVerse = verseForDate(date) || { text: '', ref: '' };
  // Honour entry lock — prompt for PIN before rendering body
  if (isLocked(page)) {
    const ok = await requestUnlock(`unlock ${date}'s journal`);
    if (!ok) {
      const blocked = document.createElement('div');
      blocked.className = 'page';
      blocked.innerHTML = `<div class="empty-state" style="padding: var(--sp-5)"><div class="empty-state-title">🔒 locked</div><div class="empty-state-hint">enter your PIN to view this entry</div></div>`;
      return blocked;
    }
  }

  const [ideas, tasks, prayers, bible, quizzes] = await Promise.all([
    all('ideas'), all('tasks'), all('prayers'), all('bible'), all('quizzes'),
  ]);
  const stampedToday = list => list.filter(x => (x.updatedAt || '').startsWith(date)).length;

  const isToday = date === new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const dueQuizzes = quizzes.filter(q => (q.status !== 'mastered' && q.status !== 'archived') && (!q.nextDueAt || q.nextDueAt <= now));
  const randomQuiz = isToday && dueQuizzes.length > 0 ? dueQuizzes[Math.floor(Math.random() * dueQuizzes.length)] : null;

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = `
    <div class="daily-ribbon">
      <span>${formatDate(date)}${dueQuizzes.length ? ` · <span class="emerald">${dueQuizzes.length} quiz due</span>` : ''}</span>
      <span class="daily-save-status" id="d-save-status" aria-live="polite">
        <span class="save-dot"></span>
        <span class="save-text">auto-saves as you type</span>
      </span>
    </div>

    <div class="daily-scripture">
      <span class="daily-scripture-text">"${esc(dailyVerse.text)}"</span>
      <span class="daily-scripture-ref">— ${esc(dailyVerse.ref)}</span>
    </div>

    ${randomQuiz ? `
      <div class="daily-quiz" data-id="${randomQuiz.id}">
        <div class="daily-quiz-head">
          <span>quick recall · ${esc(randomQuiz.sourceLabel || '?')}</span>
          <span class="num">L${randomQuiz.level || 0}</span>
        </div>
        <div class="daily-quiz-q">${esc(randomQuiz.question || '')}</div>
        <details class="quiz-answer">
          <summary>reveal</summary>
          <div>${esc(randomQuiz.answer || '')}</div>
        </details>
        <div class="quiz-actions">
          <button class="btn" data-act="skip">skip</button>
          <button class="btn is-danger" data-act="wrong">missed</button>
          <button class="btn is-primary" data-act="right">got it</button>
        </div>
      </div>
    ` : ''}

    <section class="daily-section">
      <div class="label-row">
        <div class="label">how are you today?</div>
        <button class="lock-toggle ${page.locked ? 'is-on' : ''}" id="d-lock" type="button" aria-label="${page.locked ? 'unlock entry' : 'lock entry'}" title="${page.locked ? 'unlock' : 'lock this day'}">${page.locked ? '🔒' : '🔓'}</button>
      </div>
      <div id="d-mood"></div>
    </section>

    <div class="daily-one-row">
      <input type="text" class="daily-one-line" id="d-one"
        placeholder="the day in one sentence…"
        value="${esc(page.oneSentence)}">
      <span id="d-one-mic"></span>
    </div>

    <section class="daily-section">
      <div class="label">gratitude</div>
      <div class="daily-grats">
        <input type="text" data-i="0" placeholder="·" value="${esc(page.gratitude[0] || '')}">
        <input type="text" data-i="1" placeholder="·" value="${esc(page.gratitude[1] || '')}">
        <input type="text" data-i="2" placeholder="·" value="${esc(page.gratitude[2] || '')}">
      </div>
    </section>

    <section class="daily-section">
      <div class="label-row">
        <div class="label">canvas</div>
        <span id="d-free-mic"></span>
      </div>
      <textarea id="d-free" placeholder="freeform · markdown · whatever needs out of your head">${esc(page.freeform)}</textarea>
    </section>

    <section class="daily-section">
      <div class="label">attachments · camera or folder</div>
      <div id="d-attach"></div>
    </section>

    <div class="daily-metrics">
      <span><strong>${stampedToday(ideas)}</strong> ideas</span>
      <span><strong>${stampedToday(tasks)}</strong> tasks</span>
      <span><strong>${stampedToday(bible)}</strong> verses</span>
      <span><strong>${stampedToday(prayers)}</strong> prayers</span>
      <span><strong>—</strong> fti</span>
    </div>

    <div class="daily-save-footer">
      <button type="button" class="btn is-primary" id="d-save-now">✓ save &amp; close</button>
      <span class="meta">your entries auto-save every few seconds — this button is just for peace of mind</span>
    </div>
  `;

  let livePage = { ...page };
  let lastSavedAt = 0;
  const statusEl = root.querySelector('#d-save-status');

  const setStatus = (state, ts) => {
    if (!statusEl) return;
    statusEl.className = `daily-save-status is-${state}`;
    const textEl = statusEl.querySelector('.save-text');
    if (state === 'pending')      textEl.textContent = 'saving…';
    else if (state === 'saved')   textEl.textContent = `saved · ${relTime(ts || Date.now())}`;
    else if (state === 'error')   textEl.textContent = 'save failed — try again';
    else                          textEl.textContent = 'auto-saves as you type';
  };

  // Refresh the "saved · 2s ago" text periodically
  const refreshTimer = setInterval(() => {
    if (lastSavedAt > 0 && statusEl?.classList.contains('is-saved')) {
      statusEl.querySelector('.save-text').textContent = `saved · ${relTime(lastSavedAt)}`;
    }
  }, 5000);
  // Cleanup the timer when the page unmounts
  const cleanup = new MutationObserver(() => {
    if (!document.body.contains(root)) {
      clearInterval(refreshTimer);
      cleanup.disconnect();
    }
  });
  cleanup.observe(document.body, { childList: true, subtree: true });

  const doSave = async () => {
    setStatus('pending');
    try {
      livePage = {
        ...livePage,
        oneSentence: root.querySelector('#d-one').value,
        gratitude:   Array.from(root.querySelectorAll('.daily-grats input')).map(i => i.value),
        freeform:    root.querySelector('#d-free').value,
      };
      await put('daily', livePage);
      lastSavedAt = Date.now();
      setStatus('saved', lastSavedAt);
    } catch (e) {
      console.error('[daily] save failed', e);
      setStatus('error');
    }
  };

  const save = debounce(doSave, 400);

  root.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', () => { setStatus('pending'); save(); });
  });

  // Explicit "save & close" button — flushes pending edits and navigates back
  root.querySelector('#d-save-now')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'saving…';
    await doSave();
    btn.textContent = '✓ saved';
    setTimeout(() => {
      // Send them to the dashboard for closure
      window.location.hash = '#/dashboard';
    }, 500);
  });

  // ── Mood picker ────────────────────────────────────────
  // Defensive: any throw in renderMoodPicker (stale cached module, missing API,
  // bad saved mood key) must NOT swallow the rest of the daily page. Surface a
  // visible fallback so the section never silently disappears.
  const moodHost = root.querySelector('#d-mood');
  try {
    renderMoodPicker(moodHost, {
      selected: page.mood,
      onPick: m => { livePage.mood = m; },
    });
  } catch (e) {
    console.error('[daily] mood picker failed:', e);
    moodHost.innerHTML = `<div class="meta" style="padding:8px 0;color:var(--ruby)">mood picker unavailable — refresh the page (your data is safe)</div>`;
  }

  // ── Mic buttons (Web Speech API) ───────────────────────
  if (VOICE_SUPPORTED) {
    const m1 = micButton({ label: 'dictate one-sentence', size: 32 });
    root.querySelector('#d-one-mic').appendChild(m1);
    attachDictation(m1, root.querySelector('#d-one'));

    const m2 = micButton({ label: 'dictate canvas', size: 28 });
    root.querySelector('#d-free-mic').appendChild(m2);
    attachDictation(m2, root.querySelector('#d-free'));
  }

  // ── Image attachments ─────────────────────────────────
  const attachHost = root.querySelector('#d-attach');
  renderAttachmentStrip(attachHost, page.attachments || [], {
    onChange: async (next) => {
      livePage.attachments = next;
      await put('daily', livePage);
    },
  });

  // ── Lock toggle ────────────────────────────────────────
  root.querySelector('#d-lock')?.addEventListener('click', async () => {
    const willLock = !livePage.locked;
    if (willLock && !(await hasPin())) {
      const ok = await requestUnlock('set up a vault PIN to lock entries');
      if (!ok) return;
    }
    livePage = toggleEntryLock(livePage);
    await put('daily', livePage);
    const btn = root.querySelector('#d-lock');
    btn.textContent = livePage.locked ? '🔒' : '🔓';
    btn.classList.toggle('is-on', livePage.locked);
    btn.title = livePage.locked ? 'unlock' : 'lock this day';
  });

  if (randomQuiz) {
    root.querySelectorAll('.daily-quiz button[data-act]').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const act = btn.dataset.act;
        const card = root.querySelector('.daily-quiz');
        if (act === 'skip') { card.remove(); return; }
        const correct = act === 'right';
        const q = await get('quizzes', randomQuiz.id);
        q.attempts = q.attempts || [];
        q.attempts.push({ at: new Date().toISOString(), correct });
        q.level = correct ? Math.min((q.level || 0) + 1, SR_INTERVALS_DAYS.length - 1) : 0;
        q.lastAskedAt = new Date().toISOString();
        const days = SR_INTERVALS_DAYS[q.level];
        const nd = new Date(); nd.setDate(nd.getDate() + days);
        q.nextDueAt = nd.toISOString();
        q.status = (q.level >= SR_INTERVALS_DAYS.length - 1 && correct) ? 'mastered' : 'reviewing';
        await put('quizzes', q);
        if (q.sourceStore && q.sourceId && correct) {
          const src = await get(q.sourceStore, q.sourceId);
          if (src) { src.mastery = Math.min((src.mastery || 0) + 0.2, 5); await put(q.sourceStore, src); }
        }
        card.remove();
      });
    });
  }

  return root;
}

function formatDate(d) {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).toLowerCase();
}

const VERSES = [
  'Romans 8:28', 'Proverbs 16:3', 'Psalm 90:12', 'Isaiah 26:3',
  'James 1:5',   'Philippians 4:6', 'Jeremiah 29:11', 'Joshua 1:9',
  'Psalm 37:4',  'Matthew 6:33',  'Proverbs 3:5-6', '2 Timothy 1:7',
];
function quote(date) {
  const seed = date.split('-').reduce((a, b) => a + Number(b), 0);
  return VERSES[seed % VERSES.length];
}

function normalizeDailyPage(date, stored) {
  return {
    date,
    oneSentence: '',
    gratitude: normalizeGratitude(stored?.gratitude),
    freeform: '',
    mood: null,
    attachments: Array.isArray(stored?.attachments) ? stored.attachments : [],
    locked: false,
    ...(stored || {}),
    date,
    gratitude: normalizeGratitude(stored?.gratitude),
    attachments: Array.isArray(stored?.attachments) ? stored.attachments : [],
  };
}

function normalizeGratitude(value) {
  const items = Array.isArray(value) ? value : [];
  return [items[0] || '', items[1] || '', items[2] || ''];
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5)   return 'just now';
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
