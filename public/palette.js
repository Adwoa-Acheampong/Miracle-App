import { navigate } from './router.js';
import { APP_LANES, resolveRoute } from './app-map.js';
import { R } from './util/routes.js';

function paletteItems() {
  const today = new Date().toISOString().slice(0, 10);
  return [
    { group: 'utilities', label: 'search', path: R.search },
    { group: 'utilities', label: 'book', path: R.book },
    { group: 'utilities', label: 'settings', path: R.settings },
    ...APP_LANES.flatMap(lane => lane.items.map(item => ({
      group: lane.title.toLowerCase(),
      label: item.label.toLowerCase(),
      path: resolveRoute(item, today),
    }))),
  ];
}

let root, overlay, input, list;
let items = [];
let focused = 0;

export function mountPalette(el) {
  root = el;
  root.innerHTML = `
    <div class="palette-overlay" id="pal-ov">
      <div class="palette" id="pal-box">
        <input class="palette-input" id="pal-input" placeholder="jump to…" autocomplete="off" spellcheck="false">
        <div class="palette-list" id="pal-list"></div>
      </div>
    </div>
  `;
  overlay = root.querySelector('#pal-ov');
  input   = root.querySelector('#pal-input');
  list    = root.querySelector('#pal-list');

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape')    { e.preventDefault(); closePalette(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); focused = Math.min(focused + 1, items.length - 1); render(input.value, true); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); focused = Math.max(focused - 1, 0); render(input.value, true); }
    if (e.key === 'Enter')     { e.preventDefault(); jump(items[focused]); }
  });

  overlay.addEventListener('click', e => { if (e.target === overlay) closePalette(); });
}

export function openPalette() {
  overlay.classList.add('is-open');
  input.value = '';
  focused = 0;
  render('');
  setTimeout(() => input.focus(), 30);
}

export function closePalette() {
  overlay.classList.remove('is-open');
}

function render(q, keepFocus = false) {
  const norm = q.trim().toLowerCase();
  items = paletteItems().filter(i => !norm || i.label.includes(norm) || i.group.includes(norm));
  if (!keepFocus) focused = 0;
  if (focused >= items.length) focused = Math.max(0, items.length - 1);

  if (items.length === 0) {
    list.innerHTML = `<div class="palette-group">no match</div>`;
    return;
  }

  const groups = items.reduce((acc, i) => { (acc[i.group] = acc[i.group] || []).push(i); return acc; }, {});
  list.innerHTML = Object.entries(groups).map(([g, gi]) => `
    <div class="palette-group">${g}</div>
    ${gi.map(i => `
      <div class="palette-item ${i === items[focused] ? 'is-focused' : ''}" data-label="${i.label}">
        <span class="item-mark">›</span>
        <span>${i.label}</span>
        <span class="item-meta">${g}</span>
      </div>
    `).join('')}
  `).join('');

  list.querySelectorAll('.palette-item').forEach(node => {
    node.addEventListener('click', () => {
      const item = items.find(x => x.label === node.dataset.label);
      jump(item);
    });
  });
}

function jump(item) {
  if (!item) return;
  const p = typeof item.path === 'function' ? item.path() : item.path;
  navigate(p);
  closePalette();
}
