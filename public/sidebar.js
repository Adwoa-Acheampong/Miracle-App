// Collapsible left sidebar — desktop primary nav, icon-rail by default, expands on hover/click

import { navigate, currentPath } from './router.js';
import { icon } from './icons.js';
import { R } from './util/routes.js';
import { APP_LANES, resolveRoute } from './app-map.js';

const SUPPORT_EMAIL = 'cc@miracleapp.site';
const MAILTO = `mailto:${SUPPORT_EMAIL}?subject=%5BMiracle%5D%20Hello`;

export function mountSidebar() {
  if (document.getElementById('sidebar')) return;
  const el = document.createElement('aside');
  el.id = 'sidebar';
  el.className = 'sidebar';
  if (localStorage.getItem('miracle_sidebar') === 'expanded') {
    el.classList.add('is-expanded');
  }
  const today = new Date().toISOString().slice(0, 10);
  const items = [
    { path: R.dashboard, label: 'dashboard', ic: 'layout-dashboard' },
    { path: R.book, label: 'book', ic: 'feather' },
    { type: 'sep' },
    ...APP_LANES.flatMap(lane => [
      { type: 'lane', label: lane.title },
      ...lane.items
        .filter(item => item.id !== 'dashboard')
        .map(item => ({ path: resolveRoute(item, today), label: item.label.toLowerCase(), ic: item.iconName })),
      { type: 'sep' },
    ]),
    { path: R.settings, label: 'settings', ic: 'settings' },
  ];
  el.innerHTML = `
    <div class="sb-head">
      <button class="sb-toggle" id="sb-toggle" title="toggle sidebar">
        <span class="sb-mark"></span>
        <span class="sb-brand">miracle</span>
      </button>
    </div>
    <nav class="sb-nav">
      ${items.map(it => {
        if (it.type === 'sep') return `<div class="sb-sep"></div>`;
        if (it.type === 'lane') return `<div class="sb-lane">${it.label}</div>`;
        return `
          <button class="sb-item" data-path="${it.path}" title="${it.label}">
            <span class="sb-icon">${icon(it.ic, { size: 16 })}</span>
            <span class="sb-label">${it.label}</span>
          </button>
        `;
      }).join('')}
    </nav>
    <div class="sb-contact" title="${SUPPORT_EMAIL} · click to copy · open mail">
      <a href="${MAILTO}" id="sb-contact-link" aria-label="contact support">
        <span class="sb-contact-label">${SUPPORT_EMAIL}</span>
        <span class="sb-contact-icon" aria-hidden="true">${icon('send', { size: 12 })}</span>
      </a>
    </div>
  `;
  document.body.appendChild(el);

  el.querySelector('#sb-toggle').addEventListener('click', () => {
    const expanded = el.classList.toggle('is-expanded');
    localStorage.setItem('miracle_sidebar', expanded ? 'expanded' : 'collapsed');
  });
  el.querySelectorAll('.sb-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.path));
  });

  // Contact: copy email to clipboard + try mailto. mailto often does nothing
  // when no default mail client is configured, so always give visible feedback.
  el.querySelector('#sb-contact-link')?.addEventListener('click', async e => {
    e.preventDefault();
    const copied = await copyToClipboard(SUPPORT_EMAIL);
    showContactToast(copied ? `${SUPPORT_EMAIL} · copied · opening mail…` : 'opening mail…');
    // Best-effort open default mail client; harmless if none is configured.
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = MAILTO;
      a.rel = 'noopener';
      a.click();
    }, 80);
  });

  // Apply layout offset
  document.body.classList.add('has-sidebar');

  // Keep active item highlighted
  const setActive = () => {
    const path = currentPath();
    el.querySelectorAll('.sb-item').forEach(b => {
      const p = b.dataset.path;
      b.classList.toggle('is-active',
        path === p || (p === R.dashboard && (path === '/' || path === R.dashboard)),
      );
    });
  };
  setActive();
  window.addEventListener('route:change', setActive);

  // Toast for contact copy — small, bottom-left near the contact row
  function showContactToast(text) {
    document.querySelectorAll('.sb-contact-toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = 'sb-contact-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('is-leaving'), 1800);
    setTimeout(() => t.remove(), 2400);
  }

  // Keyboard shortcut: [ toggles sidebar
  document.addEventListener('keydown', e => {
    if (e.key === '[' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
      e.preventDefault();
      el.classList.toggle('is-expanded');
      localStorage.setItem('miracle_sidebar', el.classList.contains('is-expanded') ? 'expanded' : 'collapsed');
    }
  });
}

// ─── Clipboard helper ─────────────────────────────────────────────
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* fall through to textarea fallback */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  } catch {
    return false;
  }
}
