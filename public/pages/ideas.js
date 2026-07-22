import { all } from '../store.js';
import { bindDrawerRows, reloadOnDrawerClose, renderEntryList, renderPageShell } from '../page-system.js';

export async function render() {
  const items = (await all('ideas')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const active = items.filter(item => item.status === 'active').length;
  const promoted = items.filter(item => item.status === 'promoted').length;

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = renderPageShell({
    title: 'Ideas',
    kicker: 'Build lane',
    description: 'Capture sparks before they become plans, projects, or posts.',
    iconName: 'lightbulb',
    stats: [
      { label: 'total', value: items.length },
      { label: 'active', value: active },
      { label: 'promoted', value: promoted },
    ],
    body: renderEntryList({
      items,
      store: 'ideas',
      title: item => item.title || 'untitled idea',
      meta: item => [item.status || 'active', item.weight ? `${item.weight}% weight` : ''].filter(Boolean).join(' · '),
      dotClass: item => item.status === 'archived' ? '' : 'emerald',
      empty: {
        title: 'No ideas yet',
        hint: 'Use the new button or assistant to capture a spark.',
        iconName: 'lightbulb',
      },
    }),
  });

  bindDrawerRows(root);
  reloadOnDrawerClose(root);
  return root;
}
