// MODULE 7 — Skeleton Loader System
// Renders skeleton placeholders while IndexedDB loads, swaps to real content

export function renderSkeletonList(count = 5) {
  return `<div class="skeleton-list">${
    Array.from({ length: count }, () =>
      `<div class="skeleton skeleton-row"></div>`
    ).join('')
  }</div>`;
}

export function renderSkeletonGrid(count = 6) {
  return `<div class="skeleton-grid">${
    Array.from({ length: count }, () =>
      `<div class="skeleton skeleton-card"></div>`
    ).join('')
  }</div>`;
}

export function renderSkeletonKpiGrid(count = 9) {
  return `<div class="kpi-grid">${
    Array.from({ length: count }, () =>
      `<div class="skeleton skeleton-kpi"></div>`
    ).join('')
  }</div>`;
}

export function renderSkeletonDashboard() {
  return `<div class="page page-wide">
    <div class="page-head">
      <div class="skeleton skeleton-text long" style="height:18px;width:200px"></div>
    </div>
    <div class="skeleton skeleton-text short"></div>
    <section style="margin-bottom: var(--sp-7); margin-top: var(--sp-5)">
      <div class="skeleton skeleton-text short" style="margin-bottom:8px"></div>
      ${renderSkeletonKpiGrid(9)}
    </section>
    <section>
      <div class="skeleton skeleton-text short" style="margin-bottom:8px"></div>
      <div class="skeleton skeleton-heatmap"></div>
    </section>
  </div>`;
}

export function renderEmptyState(opts = {}) {
  const { title = 'nothing here yet', hint = 'press + new to begin', icon = '∅', domain = '' } = opts;
  return `<div class="empty-state" ${domain ? `data-domain="${domain}"` : ''}>
    <div class="empty-state-icon">${icon}</div>
    <div class="empty-state-title">${title}</div>
    <div class="empty-state-hint">${hint}</div>
  </div>`;
}

// Wrapper: render skeleton immediately, then swap to real content when promise resolves
export async function withSkeleton(container, skeletonHtml, renderFn) {
  container.innerHTML = skeletonHtml;
  container.classList.add('skeleton-active');
  try {
    const real = await renderFn();
    container.classList.remove('skeleton-active');
    container.classList.add('content-revealed');
    container.innerHTML = '';
    if (real instanceof HTMLElement) {
      container.appendChild(real);
    } else if (typeof real === 'string') {
      container.innerHTML = real;
    }
  } catch (err) {
    container.classList.remove('skeleton-active');
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">!</div><div class="empty-state-title">render failed</div><div class="empty-state-hint">${err.message}</div></div>`;
  }
}
