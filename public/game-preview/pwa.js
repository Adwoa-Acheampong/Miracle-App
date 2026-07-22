const CHECK_INTERVAL = 60_000;
const SNOOZE_MS = 10 * 60_000;
const pendingKey = 'miracle_game_update_pending';
const snoozeKey = 'miracle_game_update_snooze';
let registration = null;
let currentBuild = document.querySelector('meta[name="miracle-build"]')?.content || 'dev';
let reloading = false;

export function initGamePwa() {
  const hadController = !!navigator.serviceWorker?.controller;
  const reloadButton = document.getElementById('game-update-reload');
  const laterButton = document.getElementById('game-update-later');
  reloadButton.addEventListener('click', applyUpdate);
  laterButton.addEventListener('click', snoozeUpdate);

  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(currentBuild)}`, { scope: './' }).then(reg => {
    registration = reg;
    watch(reg);
    reg.update().catch(() => {});
    if (reg.waiting) revealUpdate('service-worker');
  }).catch(() => {});

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) location.reload();
    else if (hadController || localStorage.getItem(pendingKey)) revealUpdate('service-worker');
  });

  const pending = localStorage.getItem(pendingKey);
  if (pending && pending !== currentBuild) revealUpdate(pending);
  checkGameBuild();
  window.setInterval(checkGameBuild, CHECK_INTERVAL);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      registration?.update().catch(() => {});
      checkGameBuild();
    }
  });
  window.addEventListener('online', checkGameBuild);
}

function watch(reg) {
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) revealUpdate('service-worker');
    });
  });
}

export async function checkGameBuild() {
  try {
    const response = await fetch(`/build.json?t=${Date.now()}`, { cache: 'no-store', headers: { 'Cache-Control': 'no-store' } });
    if (!response.ok) return false;
    const latest = String((await response.json()).build || '');
    if (!latest || currentBuild === 'dev' || latest === currentBuild) return false;
    revealUpdate(latest);
    return true;
  } catch {
    // Offline resumes stay quiet and use the current cached build.
    return false;
  }
}

function revealUpdate(build) {
  const snoozed = Number(localStorage.getItem(snoozeKey) || 0);
  localStorage.setItem(pendingKey, build || 'available');
  if (snoozed > Date.now()) return;
  document.getElementById('game-update').hidden = false;
}

async function applyUpdate() {
  reloading = true;
  localStorage.removeItem(pendingKey);
  localStorage.removeItem(snoozeKey);
  if (registration?.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  await registration?.update().catch(() => {});
  window.setTimeout(() => location.reload(), 500);
}

function snoozeUpdate() {
  localStorage.setItem(snoozeKey, String(Date.now() + SNOOZE_MS));
  document.getElementById('game-update').hidden = true;
}
