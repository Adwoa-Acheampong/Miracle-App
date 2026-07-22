// Hash router. Each route: { pattern: RegExp, loader: async (params) => HTMLElement }.
// Match order = registration order — first match wins.

import { esc } from './util/esc.js';

const routes = [];
let canvasEl = null;

/**
 * Register a route. Patterns are matched in registration order.
 * @param {RegExp} pattern — matched against the hash path (sans leading `#`)
 * @param {(params: string[]) => Promise<HTMLElement> | HTMLElement} loader
 *        — receives regex capture groups; returns the page element
 */
export function registerRoute(pattern, loader) {
  routes.push({ pattern, loader });
}

/**
 * Bind the router to its mount element and start listening for hashchange.
 * Call once during boot.
 * @param {HTMLElement} el — usually #canvas
 */
export function initRouter(el) {
  canvasEl = el;
  window.addEventListener('hashchange', resolve);
}

/**
 * Programmatic navigation. No-op if already on `path` — but still re-resolves
 * so callers can force a re-render of the current page.
 * @param {string} path — hash path WITHOUT the leading `#`, e.g. `/dashboard`
 */
export function navigate(path) {
  if (location.hash.slice(1) === path) resolve();
  else location.hash = path;
}

/** Current hash path (sans `#`), defaulting to `/`. */
export function currentPath() {
  return (location.hash || '#/').slice(1) || '/';
}

/**
 * Resolve the current hash path against the route table and render into canvas.
 * Shows a skeleton during async loads. Surfaces render errors safely (no XSS).
 */
export async function resolve() {
  if (!canvasEl) return;
  const path = currentPath();
  for (const { pattern, loader } of routes) {
    const m = path.match(pattern);
    if (!m) continue;
    canvasEl.innerHTML = renderSkeletonForPath(path);
    canvasEl.classList.add('skeleton-active');
    try {
      const node = await loader(m.slice(1));
      canvasEl.classList.remove('skeleton-active');
      canvasEl.replaceChildren(node);
      window.dispatchEvent(new CustomEvent('route:change', { detail: { path } }));
    } catch (err) {
      console.error('route render failed', err);
      canvasEl.classList.remove('skeleton-active');
      canvasEl.innerHTML = `<div class="page"><h1 class="page-title">render error</h1><p class="meta">${esc(err.message)}</p></div>`;
    }
    return;
  }
  canvasEl.innerHTML = `<div class="page"><h1 class="page-title">404</h1><p class="meta">${esc(path)}</p></div>`;
}

function renderSkeletonForPath(path) {
  const count = path === '/dashboard' ? 9 : 5;
  const isDashboard = path === '/dashboard' || path === '/';
  if (isDashboard) {
    return `<div class="page page-wide">
      <div class="page-head"><div class="skeleton skeleton-text long" style="height:18px;width:240px"></div></div>
      <div class="skeleton skeleton-text short"></div>
      <section style="margin: var(--sp-5) 0 var(--sp-7)">
        <div class="kpi-grid">${Array.from({length:9},()=>`<div class="skeleton skeleton-kpi"></div>`).join('')}</div>
      </section>
      <section><div class="skeleton skeleton-heatmap"></div></section>
    </div>`;
  }
  return `<div class="page">
    <div class="page-head"><div class="skeleton skeleton-text long" style="height:18px;width:160px"></div></div>
    <div class="skeleton-list">${Array.from({length:count},()=>`<div class="skeleton skeleton-row"></div>`).join('')}</div>
  </div>`;
}
