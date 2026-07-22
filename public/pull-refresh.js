// MODULE 5c — Pull-to-Refresh
// Touch-based pull-to-refresh with spring-back animation

import { resolve } from './router.js';

const TRIGGER_DISTANCE = 80;

export function initPullRefresh() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  let spinner = document.querySelector('.ptr-spinner');
  if (!spinner) {
    spinner = document.createElement('div');
    spinner.className = 'ptr-spinner';
    document.body.appendChild(spinner);
  }

  let startY = 0;
  let tracking = false;
  let refreshing = false;

  canvas.addEventListener('touchstart', e => {
    if (window.innerWidth > 640) return;
    if (refreshing) return;
    if (window.scrollY > 0) return;
    if (e.target.closest('input, textarea, select, .drawer-sheet')) return;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  canvas.addEventListener('touchmove', e => {
    if (!tracking || refreshing) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) return;
    const pull = Math.min(dy, 120);
    const progress = Math.min(1, pull / TRIGGER_DISTANCE);
    spinner.style.transform = `translateX(-50%) scale(${progress})`;
    spinner.style.opacity = String(progress);
    spinner.classList.add('is-visible');
    if (dy > 20) canvas.style.transform = `translateY(${pull * 0.4}px)`;
  }, { passive: true });

  canvas.addEventListener('touchend', async e => {
    if (!tracking) return;
    tracking = false;
    const dy = (e.changedTouches[0].clientY - startY);

    canvas.style.transition = 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    canvas.style.transform = 'translateY(0)';
    setTimeout(() => { canvas.style.transition = ''; }, 420);

    if (dy < TRIGGER_DISTANCE) {
      spinner.classList.remove('is-visible');
      spinner.style.transform = 'translateX(-50%) scale(0)';
      return;
    }

    refreshing = true;
    spinner.classList.add('is-refreshing');
    spinner.style.transform = 'translateX(-50%) scale(1)';
    spinner.style.opacity = '1';

    try {
      await resolve();
    } catch { /* ignore */ }
    setTimeout(() => {
      spinner.classList.remove('is-refreshing');
      spinner.classList.remove('is-visible');
      spinner.style.transform = 'translateX(-50%) scale(0)';
      refreshing = false;
    }, 600);
  }, { passive: true });
}
