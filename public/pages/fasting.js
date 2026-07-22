import { all } from '../store.js';
import {
  bindDrawerRows,
  renderEmptyState,
  renderEntryList,
  renderPageShell,
  reloadOnDrawerClose,
} from '../page-system.js';
import { esc } from '../util/esc.js';

export async function render() {
  const fasts = (await all('fasts')).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  const active = fasts.find(fast => !fast.endedAt);
  const past = fasts.filter(fast => fast.endedAt);
  const completed = past.filter(fast => !fast.brokenEarly?.yes).length;
  const completionRate = past.length ? Math.round((completed / past.length) * 100) : 0;
  const fastingDays = countFastDays(fasts, 90);

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = renderPageShell({
    title: 'Fasting',
    kicker: 'Faith lane',
    description: 'Track active fasts, purpose, scripture, rhythm, and reflections without losing the thread.',
    iconName: 'moon',
    stats: [
      { label: 'total', value: fasts.length },
      { label: 'active', value: active ? 'yes' : 'no' },
      { label: 'completed', value: `${completionRate}%` },
    ],
    body: fasts.length
      ? `
        ${active ? renderActiveFast(active) : renderQuietFastState()}
        <section class="sys-section">
          <div class="section-head">
            <span>Last 90 days</span>
            <small>${fastingDays} fasting days</small>
          </div>
          ${renderRibbon(fasts)}
        </section>
        <section class="sys-section">
          <div class="section-head">
            <span>History</span>
            <small>${past.length}</small>
          </div>
          ${renderEntryList({
            items: past,
            store: 'fasts',
            title: fast => fast.purpose || 'untitled fast',
            meta: fast => [fast.type || 'fast', duration(fast), (fast.startedAt || '').slice(0, 10)].filter(Boolean).join(' - '),
            empty: {
              title: 'No completed fasts yet',
              hint: 'Your completed fasts and reflections will collect here.',
              iconName: 'moon',
            },
          })}
        </section>
      `
      : renderEmptyState({
          title: 'No fasts logged yet',
          hint: 'Start with a type, purpose, scripture, and planned ending.',
          iconName: 'moon',
        }),
  });

  bindDrawerRows(root);
  reloadOnDrawerClose(root);
  return root;
}

function renderActiveFast(fast) {
  const plannedEnd = fast.plannedEndAt ? new Date(fast.plannedEndAt).getTime() : 0;
  const remaining = plannedEnd ? Math.max(0, plannedEnd - Date.now()) : 0;
  const remainingHours = plannedEnd ? Math.ceil(remaining / 3600000) : null;

  return `
    <section class="fast-active sys-active-panel" data-store="fasts" data-id="${esc(fast.id)}">
      <div>
        <span class="sys-kicker">active fast</span>
        <h2>${esc(fast.type || 'fast')}</h2>
        <p>${esc(fast.purpose || 'purpose not set')}</p>
        ${fast.scripture ? `<em class="classic-italic">${esc(fast.scripture)}</em>` : ''}
      </div>
      <div class="fast-active-stat">
        <strong>${esc(elapsed(fast.startedAt))}</strong>
        <small>${remainingHours === null ? 'open ended' : `${remainingHours}h left`}</small>
      </div>
    </section>
  `;
}

function renderQuietFastState() {
  return `
    <section class="sys-active-panel fast-rest">
      <div>
        <span class="sys-kicker">today</span>
        <h2>No active fast</h2>
        <p>Use this lane when you are ready to begin a focused fast or record a reflection.</p>
      </div>
    </section>
  `;
}

function renderRibbon(fasts) {
  const days = 90;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cells = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().slice(0, 10);
    const inFast = fasts.some(fast => {
      const start = (fast.startedAt || '').slice(0, 10);
      const end = (fast.endedAt || new Date().toISOString()).slice(0, 10);
      return dStr >= start && dStr <= end;
    });
    cells.push(`<span class="fast-ribbon-cell ${inFast ? 'is-active' : ''}" title="${dStr}"></span>`);
  }

  return `<div class="fast-ribbon">${cells.join('')}</div>`;
}

function countFastDays(fasts, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let count = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dStr = d.toISOString().slice(0, 10);
    if (fasts.some(fast => {
      const start = (fast.startedAt || '').slice(0, 10);
      const end = (fast.endedAt || new Date().toISOString()).slice(0, 10);
      return dStr >= start && dStr <= end;
    })) count++;
  }

  return count;
}

function elapsed(start) {
  if (!start) return '0h';
  const ms = Math.max(0, Date.now() - new Date(start).getTime());
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

function duration(fast) {
  if (!fast.startedAt || !fast.endedAt) return 'open ended';
  const hours = Math.max(0, Math.round((new Date(fast.endedAt) - new Date(fast.startedAt)) / 3600000));
  return `${hours}h`;
}
