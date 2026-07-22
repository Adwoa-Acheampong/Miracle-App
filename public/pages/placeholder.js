const PHASE = {
  dashboard: 7,
  dreams:    3,
  bible:     2,
  prayer:    2,
  fasting:   2,
  plans:     1,
  projects:  1,
  schedule:  1,
  meals:     3,
  finance:   2,
  blog:      5,
};

export async function render({ domain }) {
  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">${domain}</h1>
      <span class="page-meta">phase ${PHASE[domain] ?? '·'}</span>
    </div>
    <div class="empty">
      this domain ships in phase ${PHASE[domain] ?? '?'}. route resolves so navigation is honest end-to-end.
    </div>
  `;
  return root;
}
