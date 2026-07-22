// PWA install-prompt orchestration.
//
// Call initInstallPrompt() once at boot. It listens for beforeinstallprompt and,
// after the user has visited at least 2 times, surfaces a soft-dismissible
// banner. Banner reappears every ~20 min until accepted, dismissed permanently,
// or the user installs.
//
// State persisted in localStorage:
//   miracle_sessions               int — session counter (incremented per visit)
//   miracle_install_never          '1' if user clicked × ("don't ask again")
//   miracle_install_last_dismiss   ms epoch of most recent "later"

const REAPPEAR_MS = 20 * 60 * 1000;
const REVEAL_AFTER_SESSIONS = 2;
const FIRST_REVEAL_DELAY_MS = 8000;

const LS = {
  sessions:     'miracle_sessions',
  never:        'miracle_install_never',
  lastDismiss:  'miracle_install_last_dismiss',
};

let deferredPrompt = null;
let banner = null;
let revealTimer = null;
let iosInstallHint = false;

export function initInstallPrompt() {
  const sessions = incrementSessions();
  if (isStandalone() || localStorage.getItem(LS.never) === '1') return;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    if (sessions >= REVEAL_AFTER_SESSIONS) scheduleReveal(FIRST_REVEAL_DELAY_MS);
  });

  if (isIosSafari() && sessions >= REVEAL_AFTER_SESSIONS) {
    iosInstallHint = true;
    scheduleReveal(FIRST_REVEAL_DELAY_MS);
  }
}

function scheduleReveal(delay) {
  clearTimeout(revealTimer);
  revealTimer = setTimeout(showBanner, delay);
}

function showBanner() {
  if ((!deferredPrompt && !iosInstallHint) || banner) return;
  const lastDismiss = parseInt(localStorage.getItem(LS.lastDismiss) || '0', 10);
  const elapsed = Date.now() - lastDismiss;
  if (elapsed < REAPPEAR_MS) {
    scheduleReveal(REAPPEAR_MS - elapsed);
    return;
  }

  const isIos = iosInstallHint && !deferredPrompt;
  banner = document.createElement('div');
  banner.className = 'install-banner';
  banner.innerHTML = `
    <span class="install-text">install miracle on your device · keep it close</span>
    <button class="btn is-primary" data-action="accept">install</button>
    <button class="btn" data-action="later">later</button>
    <button class="btn install-x" data-action="never" title="don't ask again">×</button>
  `;
  document.body.appendChild(banner);
  banner.querySelector('.install-text').textContent = isIos
    ? 'install miracle: share, then add to home screen'
    : 'install miracle on your device - keep it close';
  banner.querySelector('[data-action="accept"]').textContent = isIos ? 'got it' : 'install';
  banner.querySelector('[data-action="never"]').textContent = 'x';

  const onOutside = e => {
    if (!banner || banner.contains(e.target)) return;
    softDismiss();
  };
  setTimeout(() => document.addEventListener('pointerdown', onOutside, { capture: true }), 100);

  banner.addEventListener('click', async e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    document.removeEventListener('pointerdown', onOutside, { capture: true });
    if (action === 'accept') {
      if (isIos) {
        localStorage.setItem(LS.lastDismiss, String(Date.now()));
        removeBanner();
        return;
      }
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      removeBanner();
    } else if (action === 'later') {
      softDismiss();
    } else if (action === 'never') {
      localStorage.setItem(LS.never, '1');
      removeBanner();
    }
  });
}

function incrementSessions() {
  const sessions = parseInt(localStorage.getItem(LS.sessions) || '0', 10) + 1;
  localStorage.setItem(LS.sessions, String(sessions));
  return sessions;
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosSafari() {
  const ua = navigator.userAgent || '';
  const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isWebKit = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  return isIos && isWebKit;
}

function softDismiss() {
  localStorage.setItem(LS.lastDismiss, String(Date.now()));
  removeBanner();
  scheduleReveal(REAPPEAR_MS);
}

function removeBanner() {
  if (!banner) return;
  banner.classList.add('is-leaving');
  setTimeout(() => { banner?.remove(); banner = null; }, 280);
}
