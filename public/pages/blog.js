import { all } from '../store.js';
import { navigate } from '../router.js';
import { openDrawer } from '../drawer.js';

import { esc } from '../util/esc.js';
import { toList } from '../util/list.js';
export async function render() {
  const blogs = (await all('blogs')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const groups = {
    seeding:    blogs.filter(b => b.status === 'seeding' || !b.status),
    drafting:   blogs.filter(b => b.status === 'drafting'),
    review:     blogs.filter(b => b.status === 'review'),
    approved:   blogs.filter(b => b.status === 'approved'),
    published:  blogs.filter(b => b.status === 'published'),
    archived:   blogs.filter(b => b.status === 'archived' || b.status === 'withdrawn'),
  };

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">blog</h1>
      <span class="page-meta">${blogs.length} total · ${groups.seeding.length} seeded · ${groups.published.length} published</span>
    </div>

    ${blogs.length === 0 ? `
      <div class="empty">no posts yet. <code>/blog seed your raw thought goes here</code></div>
    ` : `
      ${section('seeding', groups.seeding, 'ruby')}
      ${section('drafting', groups.drafting)}
      ${section('review', groups.review)}
      ${section('approved', groups.approved, 'emerald')}
      ${section('published', groups.published, 'emerald')}
      ${section('archived', groups.archived)}
    `}
  `;

  root.querySelectorAll('.entry-row').forEach(r => r.addEventListener('click', () => navigate(`/blog/${r.dataset.id}`)));
  window.addEventListener('drawer:close', once(() => { if (root.isConnected) reload(); }), { once: true });
  return root;
}

function section(label, list, dot = '') {
  if (list.length === 0) return '';
  return `
    <section class="daily-section">
      <div class="label">${label} · ${list.length}</div>
      <ul class="entry-list">
        ${list.map(b => {
          const variants = (b.variants || []).length;
          const published = (b.variants || []).filter(v => v.status === 'published').length;
          const topics = toList(b.topics).slice(0, 3);
          return `
            <li class="entry-row" data-id="${b.id}">
              <span class="dot ${dot}"></span>
              <span class="title">
                ${esc(b.title || b.seedText?.slice(0, 60) || '(untitled)')}
                <span class="meta">
                  ${topics.length ? '· ' + esc(topics.join(', ')) : ''}
                  ${variants ? ' · ' + published + '/' + variants + ' variants' : ''}
                </span>
              </span>
              <span class="meta-id">${(b.id || '').slice(-6)}</span>
            </li>
          `;
        }).join('')}
      </ul>
    </section>
  `;
}

function reload() { const h = location.hash; location.hash = '#/'; setTimeout(() => location.hash = h, 0); }
function once(fn) { let done = false; return (...a) => { if (done) return; done = true; fn(...a); }; }
