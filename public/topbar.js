// Top bar: brand, history, breadcrumb, jump/nes/vault/settings, user menu.
//
// mountTopbar(el) runs ONCE per page load. It does two things:
//   1. attach the persistent window-level listeners (user:changed, route:change,
//      vault:*, keyboard shortcuts) — one set, never duplicated
//   2. call renderTopbar(el) for the initial paint
//
// renderTopbar(el) is the idempotent repaint: clears + rebuilds the inner HTML
// and rewires per-element click handlers. user:changed triggers renderTopbar,
// never mountTopbar — that's how we avoid stacking listeners on every profile save.

import { navigate } from './router.js';
import { openPalette } from './palette.js';
import { toggleMiracle } from './miracle.js';
import { loadUser, initials, firstName, signOut as localSignOut } from './user.js';
import { icon } from './icons.js';
import { isAuthed, logout as authLogout, getCachedUser } from './auth.js';
import { hasPin, isVaultUnlocked, lockVault, requestUnlock } from './lock.js';
import { sparkleShower } from './ambient.js';
import { esc } from './util/esc.js';
import { getAppMenuGroups } from './app-map.js';
import { R } from './util/routes.js';

let mounted = false;

export async function mountTopbar(el) {
  await renderTopbar(el);
  if (mounted) return;
  mounted = true;

  // Persistent listeners — bound once, never re-bound.
  window.addEventListener('user:changed', () => renderTopbar(el));
  window.addEventListener('vault:unlocked', () => paintVault(el));
  window.addEventListener('vault:locked',   () => paintVault(el));
  window.addEventListener('route:change', e => {
    const route = el.querySelector('#tb-route');
    if (route) route.textContent = labelFor(e.detail.path);
  });
  window.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'k') { e.preventDefault(); openPalette(); }
    if (k === 'm') { e.preventDefault(); toggleMiracle(); }
  });
}

async function renderTopbar(el) {
  const user = await loadUser();
  const userName = user ? firstName(user) : 'guest';
  const userInitials = user ? initials(user.name) : '·';

  el.innerHTML = `
    <div class="tb-left">
      <button class="tb-menu-btn" id="tb-menu" title="open app menu" aria-label="open app menu">${icon('menu', { size: 16 })}</button>
      <button class="tb-nav" id="tb-back" title="back" aria-label="back">${icon('chevron-left', { size: 12 })}</button>
      <button class="tb-nav" id="tb-fwd"  title="forward" aria-label="forward">${icon('chevron-right', { size: 12 })}</button>
      <span class="tb-brand" id="tb-brand" title="dashboard">MIRACLE</span>
      <span class="tb-sep">·</span>
      <span class="tb-crumb is-active" id="tb-route">today</span>
    </div>
    <div class="tb-right">
      <button class="tb-btn" id="tb-palette" title="search">${icon('search', { size: 12 })}<span class="tb-label">search</span><kbd>Ctrl K</kbd></button>
      <button class="tb-btn" id="tb-miracle" title="Nes - tap to ask" aria-label="open Nes assistant">${icon('sparkles', { size: 12 })}<span class="tb-label">Nes</span><kbd>Ctrl M</kbd></button>
      <button class="tb-btn" id="tb-vault" title="vault - lock/unlock private entries" aria-label="vault">${icon('lock', { size: 12 })}<span class="tb-label">lock</span></button>
      <button class="tb-btn" id="tb-settings" title="settings">${icon('settings', { size: 12 })}</button>
      <button class="tb-user" id="tb-user" title="${esc(user?.calling || 'profile')}">
        <span class="tb-user-avatar">${esc(userInitials)}</span>
        <span class="tb-user-name">${esc(userName)}</span>
      </button>
    </div>
  `;

  // Per-element handlers — rebound on every repaint because the elements are new.
  el.querySelector('#tb-menu').addEventListener('click', openAppMenu);
  el.querySelector('#tb-back').addEventListener('click', () => history.back());
  el.querySelector('#tb-fwd').addEventListener('click', () => history.forward());
  el.querySelector('#tb-brand').addEventListener('click', () => {
    sparkleShower();
    navigate('/dashboard');
  });
  el.querySelector('#tb-route').addEventListener('click', openPalette);
  el.querySelector('#tb-palette').addEventListener('click', openPalette);
  el.querySelector('#tb-miracle').addEventListener('click', () => toggleMiracle());
  el.querySelector('#tb-settings').addEventListener('click', () => navigate('/settings'));
  el.querySelector('#tb-user').addEventListener('click', e => openUserMenu(e.currentTarget));
  el.querySelector('#tb-vault').addEventListener('click', () => toggleVault(el));

  paintVault(el);
}

function paintVault(el) {
  const v = el.querySelector('#tb-vault');
  if (!v) return;
  const unlocked = isVaultUnlocked();
  v.innerHTML = unlocked
    ? `${icon('unlock', { size: 12 })}<span class="tb-label">open</span>`
    : `${icon('lock', { size: 12 })}<span class="tb-label">lock</span>`;
  v.classList.toggle('is-on', !unlocked);
  v.title = unlocked ? 'vault open - click to re-lock' : 'vault locked - click to unlock';
}

function openAppMenu() {
  document.querySelectorAll('.app-menu-overlay').forEach(m => m.remove());
  const today = new Date().toISOString().slice(0, 10);
  const groups = getAppMenuGroups(today);
  const overlay = document.createElement('div');
  overlay.className = 'app-menu-overlay';
  overlay.innerHTML = `
    <div class="app-menu-panel" role="dialog" aria-modal="true" aria-label="Miracle menu">
      <div class="app-menu-head">
        <div>
          <div class="app-menu-kicker">Miracle</div>
          <div class="app-menu-title">Choose your lane</div>
        </div>
        <button class="app-menu-close" type="button" aria-label="close menu">${icon('x', { size: 15 })}</button>
      </div>
      <div class="app-menu-groups">
        ${groups.map(group => `
          <section class="app-menu-group">
            <h2>${esc(group.title)}</h2>
            <div class="app-menu-items">
              ${group.items.map(item => {
                return `
                  <button class="app-menu-item" type="button" data-route="${esc(item.route)}">
                    <span class="app-menu-icon">${icon(item.iconName, { size: 17 })}</span>
                    <span class="app-menu-copy">
                      <strong>${esc(item.label)}</strong>
                      <small>${esc(item.desc)}</small>
                    </span>
                  </button>
                `;
              }).join('')}
            </div>
          </section>
        `).join('')}
        <section class="app-menu-group app-menu-utility">
          <h2>Recovery</h2>
          <div class="app-menu-items">
            <button class="app-menu-item" type="button" data-route="${esc(R.trash)}">
              <span class="app-menu-icon">${icon('trash-2', { size: 17 })}</span>
              <span class="app-menu-copy">
                <strong>Trash bin</strong>
                <small>restore deleted entries for 30 days</small>
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  `;

  const close = () => overlay.remove();
  overlay.querySelector('.app-menu-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('[data-route]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigate(btn.dataset.route);
      close();
    });
  });
  document.body.appendChild(overlay);
}

async function toggleVault(el) {
  if (isVaultUnlocked()) { lockVault(); paintVault(el); return; }
  const reason = (await hasPin()) ? 'unlock the vault for this session' : 'set up a vault PIN';
  await requestUnlock(reason);
  paintVault(el);
}

function labelFor(path) {
  if (path.startsWith('/day/'))  return 'today';
  if (path.startsWith('/blog/')) return 'blog edit';
  return path.replace(/^\//, '') || 'today';
}

async function openUserMenu(anchor) {
  document.querySelectorAll('.tb-user-menu').forEach(m => m.remove());
  const cached = getCachedUser();
  const localProfile = await loadUser();
  const authed = isAuthed();
  const hasLocalProfile = !!(localProfile && localProfile.name);
  const hasIdentity = authed || hasLocalProfile || !!(cached && (cached.name || cached.email));
  const displayName  = cached?.name  || localProfile?.name  || '';
  const displayEmail = cached?.email || localProfile?.email || '';

  // Anyone past the welcome gate has an identity (cloud or local). Show "log out"
  // for them; only show "log in" to true guests.
  let tailItem;
  if (authed) {
    tailItem = '<button class="tb-user-menu-item is-danger" data-action="logout">log out</button>';
  } else if (hasIdentity) {
    tailItem = `
      <button class="tb-user-menu-item" data-action="login">sync to cloud</button>
      <button class="tb-user-menu-item is-danger" data-action="logout">log out</button>
    `;
  } else {
    tailItem = '<button class="tb-user-menu-item is-primary" data-action="login">log in</button>';
  }

  const menu = document.createElement('div');
  menu.className = 'tb-user-menu';
  menu.innerHTML = `
    ${hasIdentity && (displayName || displayEmail) ? `
      <div class="tb-user-menu-head">
        <div class="tb-user-menu-name">${esc(displayName || displayEmail)}</div>
        ${displayEmail ? `<div class="tb-user-menu-email meta">${esc(displayEmail)}</div>` : ''}
        <div class="tb-user-menu-meta meta">${authed ? 'cloud synced' : 'local on this device'}</div>
      </div>
    ` : ''}
    <button class="tb-user-menu-item" data-action="moji">customize avatar</button>
    <button class="tb-user-menu-item" data-action="settings">settings</button>
    ${tailItem}
  `;
  document.body.appendChild(menu);

  const rect = anchor.getBoundingClientRect();
  menu.style.top  = `${rect.bottom + 6}px`;
  menu.style.right = `${Math.max(8, window.innerWidth - rect.right)}px`;

  const dismiss = e => {
    if (menu.contains(e.target) || anchor.contains(e.target)) return;
    menu.remove();
    document.removeEventListener('pointerdown', dismiss, { capture: true });
  };
  setTimeout(() => document.addEventListener('pointerdown', dismiss, { capture: true }), 50);

  menu.querySelectorAll('.tb-user-menu-item').forEach(b => {
    b.addEventListener('click', async () => {
      const action = b.dataset.action;
      menu.remove();
      if      (action === 'moji')     navigate('/bitmoji');
      else if (action === 'settings') navigate('/settings');
      else if (action === 'login')    navigate('/login');
      else if (action === 'logout')   await handleLogout(authed, hasLocalProfile);
    });
  });
}

async function handleLogout(authed, hasLocalProfile) {
  if (authed) await authLogout();
  if (hasLocalProfile) await localSignOut();
  // Tear down the shell so even if reload is slow the user sees no app chrome.
  document.getElementById('sidebar')?.remove();
  document.body.classList.remove('has-sidebar');
  // Cache-bust so SW / browser can't serve a stale entry point.
  window.location.href = window.location.origin + window.location.pathname + '?signedout=' + Date.now();
}

// (sparkleShower has moved to ambient.js — re-export for any legacy importer)
export { sparkleShower } from './ambient.js';
