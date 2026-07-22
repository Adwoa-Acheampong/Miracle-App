// /prophecies — log and steward words received over your life.
// Captures: word · speaker · platform · date · scripture · theme · status.
// Status flow: active → partially-fulfilled → fulfilled (or cancelled).

import { all, put, ulid } from '../store.js';
import { openDrawer } from '../drawer.js';
import { PROPHECY_PLATFORMS, PROPHECY_STATUSES } from '../domain.js';

import { esc } from '../util/esc.js';
export async function render() {
  const rows = await all('prophecies').catch(() => []);
  const active     = rows.filter(p => p.status === 'active' || !p.status);
  const partial    = rows.filter(p => p.status === 'partially-fulfilled');
  const fulfilled  = rows.filter(p => p.status === 'fulfilled');
  const cancelled  = rows.filter(p => p.status === 'cancelled' || p.status === 'archived');

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">prophecies</h1>
      <div class="page-sub">words received · steward them like Mary did — pondered, recorded, watched</div>
    </div>

    <section class="prophecy-quick" id="pq">
      <textarea id="pq-word" class="prophecy-input" placeholder="the word i received… (paste / dictate)"></textarea>
      <div class="prophecy-row">
        <input type="text" id="pq-speaker" placeholder="who spoke it" class="prophecy-field">
        <select id="pq-platform" class="prophecy-field">
          ${PROPHECY_PLATFORMS.map(p => `<option value="${p}">${p}</option>`).join('')}
        </select>
        <input type="date" id="pq-date" class="prophecy-field" value="${new Date().toISOString().slice(0, 10)}">
      </div>
      <div class="prophecy-row">
        <input type="text" id="pq-scripture" placeholder="supporting scripture (e.g. Isaiah 60:1)" class="prophecy-field" style="flex:2">
        <input type="text" id="pq-theme" placeholder="theme · e.g. family, healing, business" class="prophecy-field" style="flex:1">
      </div>
      <button class="btn is-primary" id="pq-save">+ record prophecy</button>
    </section>

    ${sectionRows('active · awaiting fulfilment', active, 'active')}
    ${sectionRows('partially fulfilled', partial, 'partially-fulfilled')}
    ${sectionRows('fulfilled · receipts', fulfilled, 'fulfilled')}
    ${sectionRows('cancelled or archived', cancelled, 'cancelled')}

    <div class="meta" style="text-align:center;padding:var(--sp-4);opacity:0.6">
      ${rows.length} total · ${active.length} active · ${fulfilled.length} fulfilled
    </div>
  `;

  // Save handler
  root.querySelector('#pq-save').addEventListener('click', async () => {
    const word = root.querySelector('#pq-word').value.trim();
    if (!word) return;
    const entry = {
      id: ulid(),
      word,
      speaker:        root.querySelector('#pq-speaker').value.trim(),
      platform:       root.querySelector('#pq-platform').value,
      dateReceived:   root.querySelector('#pq-date').value || new Date().toISOString().slice(0, 10),
      scripture:      root.querySelector('#pq-scripture').value.trim(),
      theme:          root.querySelector('#pq-theme').value.trim().toLowerCase(),
      status:         'active',
      fulfillmentNotes: '',
    };
    await put('prophecies', entry);
    // Refresh the page
    const fresh = await render();
    root.replaceWith(fresh);
  });

  // Open drawer on row click
  root.querySelectorAll('.prophecy-row-card').forEach(card => {
    card.addEventListener('click', () => openDrawer('prophecies', card.dataset.id));
  });

  // Quick "fulfilled / cancelled" actions
  root.querySelectorAll('[data-action="fulfill"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const row = btn.closest('.prophecy-row-card');
      const entry = rows.find(r => r.id === row.dataset.id);
      if (!entry) return;
      entry.status = 'fulfilled';
      entry.fulfilledOn = new Date().toISOString().slice(0, 10);
      await put('prophecies', entry);
      const fresh = await render();
      root.replaceWith(fresh);
    });
  });
  root.querySelectorAll('[data-action="cancel"]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const row = btn.closest('.prophecy-row-card');
      const entry = rows.find(r => r.id === row.dataset.id);
      if (!entry) return;
      if (!confirm('cancel this prophecy? you can still see it under cancelled.')) return;
      entry.status = 'cancelled';
      await put('prophecies', entry);
      const fresh = await render();
      root.replaceWith(fresh);
    });
  });

  return root;
}

function sectionRows(title, items, status) {
  if (items.length === 0) return '';
  return `
    <section class="daily-section">
      <div class="label">${title} · ${items.length}</div>
      <div class="prophecy-list">
        ${items.map(p => `
          <article class="prophecy-row-card is-${esc(status)}" data-id="${esc(p.id)}">
            <div class="prophecy-card-head">
              <span class="prophecy-platform">${esc(p.platform || 'unknown')}</span>
              <span class="meta">${esc(p.dateReceived || '')}${p.speaker ? ' · ' + esc(p.speaker) : ''}</span>
            </div>
            <div class="prophecy-card-word">${esc(snip(p.word, 240))}</div>
            ${p.scripture ? `<div class="prophecy-card-scrip">📖 ${esc(p.scripture)}${p.theme ? ' · ' + esc(p.theme) : ''}</div>` : (p.theme ? `<div class="prophecy-card-scrip">· ${esc(p.theme)}</div>` : '')}
            ${status === 'active' || status === 'partially-fulfilled' ? `
              <div class="prophecy-card-actions">
                <button class="btn-tiny" data-action="fulfill">✓ fulfilled</button>
                <button class="btn-tiny is-danger" data-action="cancel">✕ cancel</button>
              </div>
            ` : ''}
            ${p.fulfilledOn ? `<div class="meta">fulfilled ${esc(p.fulfilledOn)}</div>` : ''}
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function snip(s, n) { const str = String(s || ''); return str.length > n ? str.slice(0, n) + '…' : str; }
