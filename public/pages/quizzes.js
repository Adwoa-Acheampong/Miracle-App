import { all, put } from '../store.js';
import { SR_INTERVALS_DAYS } from '../domain.js';
import { openDrawer } from '../drawer.js';

import { esc } from '../util/esc.js';
export async function render() {
  const quizzes = (await all('quizzes'));
  const now = new Date().toISOString();
  const due       = quizzes.filter(q => (q.status !== 'mastered' && q.status !== 'archived') && (!q.nextDueAt || q.nextDueAt <= now));
  const upcoming  = quizzes.filter(q => q.nextDueAt && q.nextDueAt > now && q.status !== 'mastered' && q.status !== 'archived').sort((a, b) => a.nextDueAt.localeCompare(b.nextDueAt));
  const mastered  = quizzes.filter(q => q.status === 'mastered');

  const bySource = quizzes.reduce((acc, q) => {
    const k = q.sourceLabel || q.sourceStore || '?';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">quizzes</h1>
      <span class="page-meta">${due.length} due · ${upcoming.length} upcoming · ${mastered.length} mastered</span>
    </div>

    ${quizzes.length === 0 ? `
      <div class="empty">no quizzes yet. <code>/quiz from bible:romans</code> generates a prompt for claude.</div>
    ` : `
      ${due.length ? `
        <section class="daily-section">
          <div class="label">due now · ${due.length}</div>
          ${due.slice(0, 50).map(q => quizCardHTML(q)).join('')}
        </section>
      ` : ''}

      ${Object.keys(bySource).length ? `
        <section class="daily-section">
          <div class="label">by source</div>
          <div class="dream-types">
            ${Object.entries(bySource).map(([k, n]) => `<span class="chip">${esc(k)} · ${n}</span>`).join('')}
          </div>
        </section>
      ` : ''}

      ${upcoming.length ? `
        <section class="daily-section">
          <div class="label">upcoming · ${upcoming.length}</div>
          <ul class="entry-list">
            ${upcoming.slice(0, 20).map(q => `
              <li class="entry-row" data-id="${q.id}">
                <span class="dot"></span>
                <span class="title">${esc((q.question || '').slice(0, 90))} <span class="meta">· ${esc(q.sourceLabel || '?')}</span></span>
                <span class="meta-id">${formatDue(q.nextDueAt)}</span>
              </li>
            `).join('')}
          </ul>
        </section>
      ` : ''}
    `}
  `;

  attachHandlers(root);
  window.addEventListener('drawer:close', once(() => { if (root.isConnected) reload(); }), { once: true });
  return root;
}

function quizCardHTML(q) {
  return `
    <div class="quiz-card" data-id="${q.id}">
      <div class="quiz-meta">
        <span>${esc(q.sourceLabel || '?')}</span>
        <span class="num">L${q.level || 0}</span>
      </div>
      <div class="quiz-q">${esc(q.question || '')}</div>
      ${q.type === 'mc' && q.choices ? `
        <ul class="quiz-choices">
          ${(typeof q.choices === 'string' ? q.choices.split('\n') : q.choices).map(c => `<li>${esc(c)}</li>`).join('')}
        </ul>
      ` : ''}
      <details class="quiz-answer">
        <summary>reveal answer</summary>
        <div>${esc(q.answer || '')}</div>
      </details>
      <div class="quiz-actions">
        <button class="btn" data-act="wrong" data-id="${q.id}">missed</button>
        <button class="btn is-primary" data-act="right" data-id="${q.id}">got it</button>
        <button class="btn" data-act="open" data-id="${q.id}">edit</button>
      </div>
    </div>
  `;
}

function attachHandlers(root) {
  root.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const act = btn.dataset.act;
      const id = btn.dataset.id;
      const q  = (await all('quizzes')).find(x => x.id === id);
      if (!q) return;
      if (act === 'open') return openDrawer('quizzes', id);
      const correct = act === 'right';
      q.attempts = q.attempts || [];
      q.attempts.push({ at: new Date().toISOString(), correct });
      q.level = correct ? Math.min((q.level || 0) + 1, SR_INTERVALS_DAYS.length - 1) : 0;
      q.lastAskedAt = new Date().toISOString();
      const days = SR_INTERVALS_DAYS[q.level];
      const next = new Date(); next.setDate(next.getDate() + days);
      q.nextDueAt = next.toISOString();
      if (q.level >= SR_INTERVALS_DAYS.length - 1 && correct) q.status = 'mastered';
      else q.status = 'reviewing';
      await put('quizzes', q);

      // Update mastery on source
      if (q.sourceStore && q.sourceId && correct) {
        const { get } = await import('../store.js');
        const src = await get(q.sourceStore, q.sourceId);
        if (src) {
          src.mastery = Math.min((src.mastery || 0) + 0.2, 5);
          await put(q.sourceStore, src);
        }
      }

      reload();
    });
  });
  root.querySelectorAll('.entry-row').forEach(r => r.addEventListener('click', () => openDrawer('quizzes', r.dataset.id)));
}

function formatDue(iso) {
  if (!iso) return 'now';
  const ms = new Date(iso) - Date.now();
  const d = Math.round(ms / 86400000);
  if (d < 1) return 'today';
  if (d === 1) return 'tomorrow';
  return `${d}d`;
}

function reload() { const h = location.hash; location.hash = '#/'; setTimeout(() => location.hash = h, 0); }
function once(fn) { let done = false; return (...a) => { if (done) return; done = true; fn(...a); }; }
