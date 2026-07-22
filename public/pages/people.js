import { all } from '../store.js';
import { bindDrawerRows, reloadOnDrawerClose, renderEntryList, renderPageShell } from '../page-system.js';

export async function render() {
  const items = (await all('people')).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const week = new Date();
  week.setDate(week.getDate() - 7);
  const weekIso = week.toISOString().slice(0, 10);
  const touched = items.filter(person => (person.lastTouchedAt || '') >= weekIso).length;
  const praying = items.filter(person => person.pray === 'yes' || person.pray === true).length;

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = renderPageShell({
    title: 'People',
    kicker: 'Life lane',
    description: 'Remember who needs care, prayer, follow-up, or attention.',
    iconName: 'users',
    stats: [
      { label: 'total', value: items.length },
      { label: 'touched 7d', value: touched },
      { label: 'in prayer', value: praying },
    ],
    body: `
      <p class="sys-verse classic-italic">"love your neighbour as yourself." <span>Matthew 22:39</span></p>
      ${renderEntryList({
        items,
        store: 'people',
        title: person => person.name || 'unnamed person',
        meta: person => [person.role, person.note ? person.note.slice(0, 80) : '', person.lastTouchedAt ? `touched ${person.lastTouchedAt}` : ''].filter(Boolean).join(' · '),
        dotClass: person => (person.pray === 'yes' || person.pray === true) ? 'emerald' : '',
        empty: {
          title: 'No people yet',
          hint: 'Add relationships you want to remember and care for.',
          iconName: 'users',
        },
      })}
    `,
  });

  bindDrawerRows(root);
  reloadOnDrawerClose(root);
  return root;
}
