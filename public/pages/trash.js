import { STORE_NAMES, all, restore, hardDelete, purgeTrash } from '../store.js';
import { icon } from '../icons.js';
import { esc } from '../util/esc.js';

const HIDDEN_STORES = new Set(['meta', 'fti', 'tags', 'mentions']);
const KEY_PATHS = {
  daily: 'date',
  tags: 'name',
  meta: 'key',
  fti: 'date',
};

export async function render() {
  await purgeTrash().catch(() => 0);
  const rows = await collectTrash();
  const root = document.createElement('div');
  root.className = 'page page-wide trash-page';
  root.innerHTML = `
    <div class="page-head">
      <div>
        <div class="sys-kicker">Recovery</div>
        <h1 class="page-title">Trash bin</h1>
        <p class="sys-page-desc">Deleted entries stay here for 30 days before they are wiped from the database.</p>
      </div>
      <button class="btn" id="trash-purge" type="button">${icon('trash-2', { size: 14 })} purge expired</button>
    </div>

    ${rows.length ? `
      <section class="trash-list" aria-label="deleted entries">
        ${rows.map(renderTrashRow).join('')}
      </section>
    ` : `
      <section class="sys-empty trash-empty">
        <span class="feature-icon">${icon('trash-2', { size: 18 })}</span>
        <strong>Trash is empty</strong>
        <p>Deleted entries and discarded drafts will appear here until their 30-day recovery window expires.</p>
      </section>
    `}
  `;

  root.querySelector('#trash-purge')?.addEventListener('click', async () => {
    await purgeTrash();
    root.replaceWith(await render());
  });
  root.querySelectorAll('[data-trash-action]').forEach(btn => {
    btn.addEventListener('click', async event => {
      event.stopPropagation();
      const action = btn.dataset.trashAction;
      const store = btn.dataset.store;
      const key = btn.dataset.key;
      if (action === 'restore') {
        await restore(store, key);
      } else if (action === 'delete') {
        if (!confirm('permanently delete this entry now? this cannot be undone.')) return;
        await hardDelete(store, key);
      }
      root.replaceWith(await render());
    });
  });

  return root;
}

async function collectTrash() {
  const pairs = await Promise.all(STORE_NAMES
    .filter(store => !HIDDEN_STORES.has(store))
    .map(async store => {
      const rows = await all(store, { includeDeleted: true, includeDrafts: true }).catch(() => []);
      return rows
        .filter(row => row && (row._deleted || row.deletedAt))
        .map(row => ({ store, row }));
    }));
  return pairs.flat().sort((a, b) => (b.row.deletedAt || '').localeCompare(a.row.deletedAt || ''));
}

function renderTrashRow({ store, row }) {
  const key = keyFor(store, row);
  const title = titleFor(store, row);
  const deletedAt = row.deletedAt ? formatDate(row.deletedAt) : 'recently';
  const expires = row.purgeAt ? `${daysUntil(row.purgeAt)} days left` : '30 days left';
  const reason = row.deletedReason === 'discarded draft' ? 'unsaved draft' : 'deleted';
  return `
    <article class="trash-row">
      <span class="trash-row-icon">${icon('trash-2', { size: 16 })}</span>
      <div class="trash-row-copy">
        <strong>${esc(title)}</strong>
        <span>${esc(store)} &middot; ${esc(reason)} &middot; ${esc(deletedAt)} &middot; ${esc(expires)}</span>
      </div>
      <div class="trash-row-actions">
        <button class="btn" type="button" data-trash-action="restore" data-store="${esc(store)}" data-key="${esc(String(key))}">
          ${icon('rotate-ccw', { size: 13 })} restore
        </button>
        <button class="btn is-danger" type="button" data-trash-action="delete" data-store="${esc(store)}" data-key="${esc(String(key))}">
          delete now
        </button>
      </div>
    </article>
  `;
}

function keyFor(store, row) {
  return row?.[KEY_PATHS[store] || 'id'];
}

function titleFor(store, row) {
  return row.title || row.subject || row.passage || row.name || row.venture || row.oneSentence || row.freeform || row.date || row.id || store;
}

function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function daysUntil(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(diff)) return 30;
  return Math.max(0, Math.ceil(diff / 86400000));
}
