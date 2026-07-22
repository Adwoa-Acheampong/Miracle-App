// MODULE 5b — Swipe Navigation
// Horizontal swipe between domain pages (mobile only)

import { navigate, currentPath } from './router.js';

const DOMAIN_ORDER = [
  '/dashboard', '/dreams', '/ideas', '/bible', '/prayer', '/fasting',
  '/plans', '/projects', '/tasks', '/schedule', '/finance', '/meals',
  '/people', '/testimony', '/music', '/books', '/blog', '/quizzes',
];

const SWIPE_THRESHOLD = 60;
const VERTICAL_TOLERANCE = 40;

export function initSwipeNav() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  let startX = 0, startY = 0, startTime = 0;
  let tracking = false;
  let axisLocked = null;

  canvas.addEventListener('touchstart', e => {
    if (window.innerWidth > 640) return;
    if (e.target.closest('input, textarea, select, .drawer-sheet, .palette-input')) return;
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    startTime = Date.now();
    tracking = true;
    axisLocked = null;
  }, { passive: true });

  canvas.addEventListener('touchmove', e => {
    if (!tracking) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (axisLocked === null) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        axisLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
    }
    if (axisLocked === 'x') {
      e.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    if (!tracking) return;
    tracking = false;
    if (axisLocked !== 'x') return;

    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    const dt = Date.now() - startTime;
    if (Math.abs(dy) > VERTICAL_TOLERANCE) return;
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (dt > 800) return;

    const idx = DOMAIN_ORDER.indexOf(currentPath());
    if (idx < 0) return;
    const next = dx < 0 ? idx + 1 : idx - 1;
    if (next < 0 || next >= DOMAIN_ORDER.length) return;

    const exitDir = dx < 0 ? '-100vw' : '100vw';
    const enterDir = dx < 0 ? '100vw' : '-100vw';
    canvas.style.transition = 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms';
    canvas.style.transform = `translateX(${exitDir})`;
    canvas.style.opacity = '0';
    setTimeout(() => {
      canvas.style.transition = 'none';
      canvas.style.transform = `translateX(${enterDir})`;
      navigate(DOMAIN_ORDER[next]);
      requestAnimationFrame(() => {
        canvas.style.transition = 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms';
        canvas.style.transform = 'translateX(0)';
        canvas.style.opacity = '1';
        setTimeout(() => {
          canvas.style.transition = '';
          canvas.style.transform = '';
          canvas.style.opacity = '';
        }, 260);
      });
    }, 260);
  }, { passive: true });
}
