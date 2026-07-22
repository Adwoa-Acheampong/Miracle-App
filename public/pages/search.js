import { search, buildIndex } from '../search.js';

import { esc } from '../util/esc.js';
export async function render() {
  await buildIndex();
  const qs = new URLSearchParams((location.hash.split('?')[1]) || '');
  const initialQ = qs.get('q') || '';

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">search</h1>
      <span class="page-meta" id="s-count">type to search · ⌘k for jump</span>
    </div>

    <input type="text" id="s-input" class="daily-one-line" placeholder="search across everything…" value="${esc(initialQ)}" autocomplete="off" spellcheck="false">

    <div id="s-results" style="margin-top: 48px"></div>
  `;

  const inp     = root.querySelector('#s-input');
  const results = root.querySelector('#s-results');
  const count   = root.querySelector('#s-count');

  const doSearch = async q => {
    if (!q.trim()) { results.innerHTML = ''; count.textContent = 'type to search'; return; }
    const res = await search(q);
    count.textContent = `${res.length} result${res.length === 1 ? '' : 's'}`;
    if (res.length === 0) { results.innerHTML = `<div class="empty">no matches.</div>`; return; }
    const grouped = res.reduce((acc, r) => { (acc[r.store] = acc[r.store] || []).push(r); return acc; }, {});
    results.innerHTML = Object.entries(grouped).map(([store, list]) => `
      <section class="daily-section">
        <div class="label">${store} · ${list.length}</div>
        <ul class="entry-list">
          ${list.slice(0, 20).map(r => `
            <li class="entry-row" data-store="${store}" data-id="${r.id}">
              <span class="dot emerald"></span>
              <span class="title">${esc(r.title)}</span>
              <span class="meta-id">${String(r.id || '').slice(-6)}</span>
            </li>
          `).join('')}
        </ul>
      </section>
    `).join('');

    results.querySelectorAll('.entry-row').forEach(row => {
      row.addEventListener('click', async () => {
        const { openDrawer } = await import('../drawer.js');
        openDrawer(row.dataset.store, row.dataset.id);
      });
    });
  };

  setTimeout(() => inp.focus(), 30);
  if (initialQ) doSearch(initialQ);

  let t;
  inp.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => doSearch(inp.value), 180);
  });

  return root;
}
