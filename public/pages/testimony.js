import { all } from '../store.js';
import { bindDrawerRows, reloadOnDrawerClose, renderEntryList, renderPageShell } from '../page-system.js';

export async function render() {
  const items = (await all('testimonies')).sort((a, b) =>
    (b.date || b.updatedAt || '').localeCompare(a.date || a.updatedAt || ''),
  );
  const week = new Date();
  week.setDate(week.getDate() - 7);
  const weekIso = week.toISOString().slice(0, 10);
  const thisWeek = items.filter(item => (item.date || '') >= weekIso).length;

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = renderPageShell({
    title: 'Testimony',
    kicker: 'Faith lane',
    description: 'Record what God did so answered prayer becomes memory.',
    iconName: 'megaphone',
    stats: [
      { label: 'recorded', value: items.length },
      { label: 'this week', value: thisWeek },
    ],
    body: `
      <p class="sys-verse classic-italic">"they overcame him by the blood of the Lamb, and by the word of their testimony." <span>Revelation 12:11</span></p>
      ${renderEntryList({
        items,
        store: 'testimonies',
        title: item => item.title || 'untitled testimony',
        meta: item => [item.date || (item.updatedAt || '').slice(0, 10), item.scripture].filter(Boolean).join(' · '),
        dotClass: () => 'emerald',
        empty: {
          title: 'No testimonies yet',
          hint: 'Record answered prayers, provision, direction, and deliverance.',
          iconName: 'megaphone',
        },
      })}
    `,
  });

  bindDrawerRows(root);
  reloadOnDrawerClose(root);
  return root;
}
