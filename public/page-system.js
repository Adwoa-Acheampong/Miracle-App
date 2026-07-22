import { openDrawer } from './drawer.js';
import { icon } from './icons.js';
import { esc } from './util/esc.js';

export function renderPageShell({
  title,
  kicker,
  description,
  iconName = 'layout-dashboard',
  stats = [],
  body = '',
}) {
  return `
    <div class="page-head sys-page-head">
      <div class="sys-page-titleblock">
        <span class="sys-page-icon">${icon(iconName, { size: 18 })}</span>
        <div>
          ${kicker ? `<div class="sys-kicker">${esc(kicker)}</div>` : ''}
          <h1 class="page-title">${esc(title)}</h1>
          ${description ? `<p class="sys-page-desc">${esc(description)}</p>` : ''}
        </div>
      </div>
      ${stats.length ? `
        <div class="sys-stat-strip">
          ${stats.map(stat => `
            <span class="sys-stat">
              <strong>${esc(String(stat.value))}</strong>
              <small>${esc(stat.label)}</small>
            </span>
          `).join('')}
        </div>
      ` : ''}
    </div>
    ${body}
  `;
}

export function renderEmptyState({ title, hint, iconName = 'sparkles' }) {
  return `
    <div class="sys-empty">
      <span class="sys-empty-icon">${icon(iconName, { size: 20 })}</span>
      <strong>${esc(title)}</strong>
      ${hint ? `<small>${esc(hint)}</small>` : ''}
    </div>
  `;
}

export function renderEntryList({
  items,
  store,
  title,
  meta,
  dotClass,
  empty,
}) {
  if (!items.length) return renderEmptyState(empty);
  return `
    <ul class="entry-list sys-entry-list">
      ${items.map(item => `
        <li class="entry-row sys-entry-row" data-store="${esc(store)}" data-id="${esc(item.id)}">
          <span class="dot ${esc(dotClass?.(item) || 'emerald')}"></span>
          <span class="title">
            ${esc(title(item))}
            ${meta ? `<span class="meta">${esc(meta(item))}</span>` : ''}
          </span>
          <span class="meta-id">${esc((item.id || '').slice(-6))}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

export function bindDrawerRows(root) {
  root.querySelectorAll('[data-store][data-id]').forEach(row => {
    row.addEventListener('click', () => openDrawer(row.dataset.store, row.dataset.id));
  });
}

export function reloadOnDrawerClose(root) {
  window.addEventListener('drawer:close', once(() => {
    if (root.isConnected) {
      const h = location.hash;
      location.hash = '#/';
      setTimeout(() => { location.hash = h; }, 0);
    }
  }), { once: true });
}

function once(fn) {
  let done = false;
  return (...args) => {
    if (done) return;
    done = true;
    fn(...args);
  };
}
