const CHECK_INTERVAL_MS = 60_000;
const SNOOZE_MS = 10 * 60_000;
const PENDING_KEY = 'miracle_update_pending_build';
const SNOOZE_KEY = 'miracle_update_snoozed_until';

let currentBuild = readCurrentBuild();
let pendingBuild = '';
let checking = false;

export function initUpdatePrompt() {
  pendingBuild = localStorage.getItem(PENDING_KEY) || '';
  if (pendingBuild && pendingBuild !== currentBuild) showUpdateBanner(pendingBuild);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      watchRegistration(reg);
      reg.update().catch(() => {});
    }).catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      markPending('service-worker');
    });
  }

  checkForVersion('boot');
  setInterval(() => checkForVersion('interval'), CHECK_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    checkForVersion('visible');
    if (pendingBuild && pendingBuild !== currentBuild) showUpdateBanner(pendingBuild);
  });
  window.addEventListener('online', () => checkForVersion('online'));
  window.addEventListener('pageshow', () => checkForVersion('pageshow'));
}

function watchRegistration(reg) {
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) markPending('service-worker');
    });
  });
}

async function checkForVersion(reason) {
  if (checking) return;
  checking = true;
  try {
    const latest = await readLatestBuild(reason);
    if (!latest || latest === currentBuild) return;
    markPending(latest);
  } catch {
    // Offline and flaky mobile resumes should stay quiet.
  } finally {
    checking = false;
  }
}

async function readLatestBuild(reason) {
  const query = `reason=${encodeURIComponent(reason)}&t=${Date.now()}`;
  const candidates = [`/build.json?${query}`];
  for (const url of candidates) {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
    }).catch(() => null);
    if (!response?.ok) continue;
    const data = await response.json().catch(() => null);
    const build = String(data?.build || '').trim();
    if (build && build !== '__BUILD__') return build;
  }
  return '';
}

function markPending(build) {
  pendingBuild = build || 'available';
  localStorage.setItem(PENDING_KEY, pendingBuild);
  showUpdateBanner(pendingBuild);
}

function showUpdateBanner(build) {
  const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
  if (snoozedUntil > Date.now()) return;

  let banner = document.querySelector('.update-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.className = 'update-banner';
    banner.innerHTML = `
      <span class="update-banner-text">new version available</span>
      <button class="btn is-primary update-banner-reload" type="button">reload</button>
      <button class="update-banner-dismiss" type="button" aria-label="remind me later">x</button>
    `;
    document.body.appendChild(banner);
    banner.querySelector('.update-banner-reload').addEventListener('click', async () => {
      localStorage.removeItem(PENDING_KEY);
      localStorage.removeItem(SNOOZE_KEY);
      await refreshServiceWorker();
      location.reload();
    });
    banner.querySelector('.update-banner-dismiss').addEventListener('click', () => {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
      banner.remove();
    });
  }
  banner.dataset.build = build || '';
}

async function refreshServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration('./');
  if (reg) await reg.update().catch(() => {});
}

function readCurrentBuild() {
  const meta = document.querySelector('meta[name="miracle-build"]')?.content;
  if (meta && meta !== '__BUILD__') return meta;
  const script = document.querySelector('script[type="module"][src*="main.js"]');
  try {
    const src = new URL(script?.getAttribute('src') || '', location.href);
    const build = src.searchParams.get('v');
    if (build && build !== '__BUILD__') return build;
  } catch {}
  return 'dev';
}
