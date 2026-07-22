import { all, get, put } from '../store.js';
import { startOfWeek, addDays, ymd } from '../domain.js';
import { openDrawer } from '../drawer.js';

import { esc } from '../util/esc.js';
import { formatList } from '../util/list.js';
const SLOTS = ['breakfast', 'midmorning', 'lunch', 'teatime', 'dinner', 'latenight'];
let weekOffset = 0;

export async function render() {
  const meals = await all('meals');
  const wkStart = addDays(startOfWeek(), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(wkStart, i));
  const today = ymd(new Date());

  const wkMeals = meals.filter(m => {
    const d = m.date;
    return d >= ymd(days[0]) && d <= ymd(days[6]);
  });
  const wkSpend = wkMeals.reduce((s, m) => s + Number(m.costGhs || 0), 0);
  const wkHome = wkMeals.filter(m => m.homeCooked === 'yes' || m.homeCooked === true).length;

  const root = document.createElement('div');
  root.className = 'page page-wide';
  root.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">meals</h1>
      <span class="page-meta">${wkMeals.length} this week · GHS ${wkSpend.toLocaleString()} · ${wkHome} home-cooked</span>
      <span class="week-nav">
        <button class="tb-btn" id="wk-prev">◀</button>
        <button class="tb-btn" id="wk-curr">this week</button>
        <button class="tb-btn" id="wk-next">▶</button>
      </span>
    </div>

    <div class="meal-grid">
      <div class="meal-corner"></div>
      ${days.map(d => `
        <div class="meal-day-head ${ymd(d) === today ? 'is-today' : ''}">
          <div class="week-dow">${d.toLocaleDateString(undefined, { weekday: 'short' }).toLowerCase()}</div>
          <div class="week-dom">${d.getDate()}</div>
        </div>
      `).join('')}

      ${SLOTS.map(slot => `
        <div class="meal-slot-label">${slot}</div>
        ${days.map(d => {
          const cellMeals = meals.filter(m => m.date === ymd(d) && m.slot === slot);
          return `
            <div class="meal-cell ${ymd(d) === today ? 'is-today' : ''}">
              ${cellMeals.map(m => `
                <div class="meal-card ${m.completedAt ? 'is-done' : ''}" data-id="${m.id}">
                  <input type="checkbox" class="meal-check" data-id="${m.id}" ${m.completedAt ? 'checked' : ''} title="mark eaten" />
                  <div class="meal-body">
                    <div class="meal-items">${esc(formatList(m.actualItems))}</div>
                    ${m.costGhs ? `<div class="meal-cost num">${m.costGhs}</div>` : ''}
                  </div>
                </div>
              `).join('') || '<div class="meal-empty">·</div>'}
            </div>
          `;
        }).join('')}
      `).join('')}
    </div>
  `;

  root.querySelector('#wk-prev').addEventListener('click', async () => { weekOffset--;  root.replaceWith(await render()); });
  root.querySelector('#wk-curr').addEventListener('click', async () => { weekOffset = 0; root.replaceWith(await render()); });
  root.querySelector('#wk-next').addEventListener('click', async () => { weekOffset++;  root.replaceWith(await render()); });
  root.querySelectorAll('.meal-card').forEach(c => {
    c.addEventListener('click', e => {
      if (e.target.classList.contains('meal-check')) return;
      openDrawer('meals', c.dataset.id);
    });
  });
  root.querySelectorAll('.meal-check').forEach(cb => {
    cb.addEventListener('click', async e => {
      e.stopPropagation();
      const id = cb.dataset.id;
      const current = await get('meals', id);
      if (!current) return;
      const next = { ...current, completedAt: cb.checked ? new Date().toISOString() : null };
      await put('meals', next);
      if (cb.checked) {
        const { triggerCompletionFlash, updateStreak } = await import('../rewards.js');
        triggerCompletionFlash(cb);
        updateStreak('meals');
      }
      root.replaceWith(await render());
    });
  });
  window.addEventListener('drawer:close', once(() => { if (root.isConnected) reload(); }), { once: true });
  return root;
}

function reload() { const h = location.hash; location.hash = '#/'; setTimeout(() => location.hash = h, 0); }
function once(fn) { let done = false; return (...a) => { if (done) return; done = true; fn(...a); }; }
