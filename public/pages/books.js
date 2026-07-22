import { all } from '../store.js';
import { bindDrawerRows, reloadOnDrawerClose, renderEmptyState, renderEntryList, renderPageShell } from '../page-system.js';

const BUCKETS = ['reading', 'paused', 'wishlist', 'finished'];

export async function render() {
  const books = (await all('books')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const byStatus = Object.fromEntries(BUCKETS.map(status => [status, books.filter(book => (book.status || 'reading') === status)]));

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = renderPageShell({
    title: 'Books',
    kicker: 'Life lane',
    description: 'Track reading, ideas, notes, and what should turn into action.',
    iconName: 'book-open',
    stats: [
      { label: 'reading', value: byStatus.reading.length },
      { label: 'finished', value: byStatus.finished.length },
      { label: 'wishlist', value: byStatus.wishlist.length },
    ],
    body: books.length
      ? BUCKETS.map(status => renderBookSection(status, byStatus[status])).join('')
      : renderEmptyState({
          title: 'No books yet',
          hint: 'Add what you are reading, listening to, or studying.',
          iconName: 'book-open',
        }),
  });

  bindDrawerRows(root);
  reloadOnDrawerClose(root);
  return root;
}

function renderBookSection(label, books) {
  if (!books.length) return '';
  return `
    <section class="sys-section">
      <div class="section-head">
        <span>${label}</span>
        <small>${books.length}</small>
      </div>
      ${renderEntryList({
        items: books,
        store: 'books',
        title: book => book.title || 'untitled book',
        meta: book => [book.author, book.format && book.format !== 'book' ? book.format : '', book.currentLocation, book.aiResearched === 'yes' ? 'AI enriched' : ''].filter(Boolean).join(' · '),
        dotClass: book => book.status === 'reading' ? 'emerald' : '',
        empty: { title: `No ${label} books`, hint: '', iconName: 'book-open' },
      })}
    </section>
  `;
}
