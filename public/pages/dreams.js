import { all } from '../store.js';
import { bindDrawerRows, reloadOnDrawerClose, renderEntryList, renderPageShell } from '../page-system.js';
import { toList } from '../util/list.js';
import { esc } from '../util/esc.js';

export async function render() {
  const dreams = (await all('dreams')).sort((a, b) => (b.dreamDate || '').localeCompare(a.dreamDate || ''));
  const fulfilled = dreams.filter(dream => dream.fulfilledOn);
  const open = dreams.filter(dream => !dream.fulfilledOn);
  const byType = dreams.reduce((acc, dream) => {
    const type = dream.type || 'nightDream';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = renderPageShell({
    title: 'Dreams',
    kicker: 'Memory lane',
    description: 'Notice dreams, symbols, fulfillment, and spiritual patterns.',
    iconName: 'moon',
    stats: [
      { label: 'total', value: dreams.length },
      { label: 'open', value: open.length },
      { label: 'fulfilled', value: fulfilled.length },
    ],
    body: dreams.length
      ? `
        <div class="sys-chip-row">
          ${Object.entries(byType).map(([type, count]) => `<span class="chip">${esc(type)} · ${count}</span>`).join('')}
        </div>
        ${renderDreamSection('open', open)}
        ${renderDreamSection('fulfilled', fulfilled)}
      `
      : renderEntryList({
          items: [],
          store: 'dreams',
          title: dream => dream.title,
          empty: {
            title: 'No dreams yet',
            hint: 'Record the image, date, feeling, and symbols while fresh.',
            iconName: 'moon',
          },
        }),
  });

  bindDrawerRows(root);
  reloadOnDrawerClose(root);
  return root;
}

function renderDreamSection(label, dreams) {
  if (!dreams.length) return '';
  return `
    <section class="sys-section">
      <div class="section-head">
        <span>${label}</span>
        <small>${dreams.length}</small>
      </div>
      ${renderEntryList({
        items: dreams,
        store: 'dreams',
        title: dream => dream.title || 'untitled dream',
        meta: dream => [dream.type || 'nightDream', dream.dreamDate, ...toList(dream.symbols).slice(0, 3)].filter(Boolean).join(' · '),
        dotClass: dream => dream.fulfilledOn ? 'emerald' : '',
        empty: { title: `No ${label} dreams`, hint: '', iconName: 'moon' },
      })}
    </section>
  `;
}
