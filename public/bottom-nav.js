// MODULE 5a — Bottom Navigation Bar
// Fixed bottom bar for mobile, 5 tabs, scroll hide/show

import { icon } from './icons.js';
import { navigate, currentPath } from './router.js';
import { R } from './util/routes.js';
import { APP_LANES, resolveRoute } from './app-map.js';

const REVEAL_HIDE_MS = 800;
const TAP_REVEAL_MS  = 3000;
const RETRACT_KEY = 'miracle_bottom_nav_retracted';

const TABS = [
  { key: 'dashboard', path: R.dashboard, icon: 'layout-dashboard', label: 'home' },
  { key: 'today',     path: null,        icon: 'calendar',         label: 'today' },
  { key: 'jump',      path: null,        icon: 'search',           label: '' },
  { key: 'domains',   path: null,        icon: 'grid-3x3',         label: 'domains' },
  { key: 'settings',  path: R.settings,  icon: 'settings',         label: 'config' },
];

export function mountBottomNav() {
  const nav = document.createElement('nav');
  nav.id = 'bottom-nav';
  nav.className = 'bottom-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'Main navigation');

  const today = new Date().toISOString().slice(0, 10);

  nav.innerHTML = TABS.map(t => {
    if (t.key === 'jump') {
      return `<button class="bnav-jump" data-action="jump" aria-label="Quick search">
        ${icon(t.icon, { size: 22 })}
      </button>`;
    }
    return `<button class="bnav-item" data-key="${t.key}" data-path="${t.path || ''}" aria-label="${t.label}">
      ${icon(t.icon, { size: 20 })}
      <span class="bnav-label">${t.label}</span>
    </button>`;
  }).join('');

  nav.querySelectorAll('.bnav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      if      (key === 'today')   navigate(R.day(today));
      else if (key === 'domains') toggleDomainSheet();
      else if (btn.dataset.path)  navigate(btn.dataset.path);
    });
  });

  nav.querySelector('.bnav-jump')?.addEventListener('click', () => {
    const palette = document.getElementById('palette');
    if (palette) {
      palette.classList.add('is-open');
      palette.querySelector('input')?.focus();
    }
  });

  document.body.appendChild(nav);

  const toggle = document.createElement('button');
  toggle.className = 'bottom-nav-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', 'bottom-nav');
  toggle.innerHTML = icon('chevron-down', { size: 16 });
  document.body.appendChild(toggle);

  const applyRetracted = retracted => {
    nav.classList.toggle('is-retracted', retracted);
    toggle.classList.toggle('is-retracted', retracted);
    document.body.classList.toggle('bottom-nav-retracted', retracted);
    toggle.setAttribute('aria-expanded', String(!retracted));
    toggle.setAttribute('aria-label', retracted ? 'show bottom navigation' : 'hide bottom navigation');
    if (retracted) nav.classList.remove('is-revealed', 'is-hidden');
    localStorage.setItem(RETRACT_KEY, retracted ? '1' : '0');
  };

  applyRetracted(localStorage.getItem(RETRACT_KEY) === '1');
  toggle.addEventListener('click', () => applyRetracted(!nav.classList.contains('is-retracted')));

  // Hover-zone strip at bottom edge that reveals the nav on mouse approach
  const zone = document.createElement('div');
  zone.className = 'bottom-nav-hover-zone';
  document.body.appendChild(zone);

  let hideTimer = null;
  const reveal   = () => {
    if (nav.classList.contains('is-retracted')) return;
    clearTimeout(hideTimer);
    nav.classList.add('is-revealed');
  };
  const collapse = () => {
    if (nav.classList.contains('is-retracted')) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => nav.classList.remove('is-revealed'), REVEAL_HIDE_MS);
  };
  zone.addEventListener('mouseenter', reveal);
  nav.addEventListener('mouseenter',  reveal);
  nav.addEventListener('mouseleave',  collapse);
  zone.addEventListener('mouseleave', collapse);
  // Tap anywhere on small screens reveals briefly
  zone.addEventListener('click', () => {
    if (nav.classList.contains('is-retracted')) {
      applyRetracted(false);
      return;
    }
    reveal();
    setTimeout(collapse, TAP_REVEAL_MS);
  });

  updateActiveTab();
  window.addEventListener('route:change', updateActiveTab);
}

function updateActiveTab() {
  const path = currentPath();
  document.querySelectorAll('.bnav-item').forEach(btn => {
    const key = btn.dataset.key;
    const active =
      (key === 'dashboard' && path === R.dashboard) ||
      (key === 'today'     && path.startsWith('/day/')) ||
      (key === 'settings'  && path === R.settings);
    btn.classList.toggle('is-active', active);
  });
}

let domainSheetOpen = false;
function toggleDomainSheet() {
  if (domainSheetOpen) return;
  domainSheetOpen = true;
  const today = new Date().toISOString().slice(0, 10);
  const bd = document.createElement('div');
  bd.className = 'drawer-backdrop is-open';
  const sheet = document.createElement('div');
  sheet.className = 'drawer-sheet is-open';
  sheet.style.maxHeight = '60dvh';
  sheet.innerHTML = `
    <div class="drawer-handle"></div>
    <div style="padding:var(--sp-4)">
      <div class="label" style="margin-bottom:var(--sp-3)">choose a lane</div>
      <div class="mobile-lane-sheet">
        ${APP_LANES.map(lane => `
          <section class="mobile-lane-group">
            <h3>${lane.title}</h3>
            <div class="mobile-lane-items">
              ${lane.items.map(item => `
                <button class="mobile-lane-item" data-route="${resolveRoute(item, today)}" type="button">
                  <span>${icon(item.iconName, { size: 14 })}${item.label}</span>
                  <small>${item.verb}</small>
                </button>
              `).join('')}
            </div>
          </section>
        `).join('')}
      </div>
    </div>
  `;
  const close = () => {
    bd.classList.remove('is-open');
    sheet.classList.remove('is-open');
    setTimeout(() => { bd.remove(); sheet.remove(); domainSheetOpen = false; }, 400);
  };
  bd.addEventListener('click', close);
  sheet.querySelectorAll('[data-route]').forEach(tile => {
    tile.addEventListener('click', () => { navigate(tile.dataset.route); close(); });
  });
  document.body.appendChild(bd);
  document.body.appendChild(sheet);
}
