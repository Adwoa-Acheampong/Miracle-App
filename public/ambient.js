// MODULE 8 — Ambient Intelligence Layer
// Time-of-day shift, contextual greeting signals, focus mode

import { all } from './store.js';

import { esc } from './util/esc.js';
// ═══ 8a. TIME-OF-DAY THEME SHIFT ═══

export function applyTimeOfDay() {
  const h = new Date().getHours();
  let period;
  if (h >= 5 && h < 11)       period = 'morning';
  else if (h >= 11 && h < 17)  period = 'midday';
  else if (h >= 17 && h < 22)  period = 'evening';
  else                          period = 'night';
  document.body.setAttribute('data-time', period);
}
// ═══ 8b. CONTEXTUAL GREETING SIGNAL LINE ═══

export async function buildSignalSlots() {
  const slots = [];
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().slice(0, 10);

  // Oldest open loop
  try {
    const tasks = await all('tasks');
    const open = tasks.filter(t => !t.completedAt).sort((a, b) =>
      (a.createdAt || '').localeCompare(b.createdAt || ''));
    if (open.length > 0) {
      const oldest = open[0];
      const days = Math.floor((new Date() - new Date(oldest.createdAt)) / 86400000);
      slots.push(`oldest open: "${(oldest.title || '').slice(0, 40)}" · ${days}d`);
    }
  } catch { /* skip */ }

  // Streak leader
  const domains = ['dreams','ideas','bible','prayer','fasting','plans','projects','tasks',
    'schedule','finance','meals','testimony','music','people','books','blog','quizzes'];
  let bestStreak = { domain: '', count: 0 };
  for (const d of domains) {
    try {
      const s = JSON.parse(localStorage.getItem(`miracle_streaks_${d}`));
      if (s && s.current > bestStreak.count) {
        bestStreak = { domain: d, count: s.current };
      }
    } catch { /* skip */ }
  }
  if (bestStreak.count > 0) {
    slots.push(`${bestStreak.count}-day ${bestStreak.domain} streak`);
  }

  // Weekly velocity
  let weekCount = 0;
  for (const store of ['dreams','ideas','bible','prayers','fasts','plans','projects','tasks',
    'events','transactions','meals','testimonies','music','people','books','blogs','quizzes']) {
    try {
      const rows = await all(store);
      weekCount += rows.filter(r => (r.updatedAt || r.createdAt || '') >= weekStr).length;
    } catch { /* skip */ }
  }
  const velocity = Math.min(100, Math.round((weekCount / 50) * 100));
  slots.push(`${velocity}% weekly velocity · ${weekCount} touches`);

  // Next scheduled
  try {
    const events = await all('events');
    const upcoming = events
      .filter(e => (e.startAt || '') >= new Date().toISOString())
      .sort((a, b) => (a.startAt || '').localeCompare(b.startAt || ''));
    if (upcoming.length > 0) {
      const next = upcoming[0];
      const when = new Date(next.startAt);
      const hm = when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      slots.push(`next: ${(next.title || 'event').slice(0, 30)} at ${hm}`);
    }
  } catch { /* skip */ }

  return slots;
}

let signalInterval = null;
let signalIdx = 0;

export function mountSignalLine(container, slots) {
  if (slots.length === 0) return;
  const el = document.createElement('div');
  el.className = 'signal-line';
  el.innerHTML = slots.map((s, i) =>
    `<div class="signal-line-item ${i === 0 ? 'is-active' : ''}">${esc(s)}</div>`
  ).join('');
  container.appendChild(el);

  if (signalInterval) clearInterval(signalInterval);
  signalIdx = 0;
  signalInterval = setInterval(() => {
    const items = el.querySelectorAll('.signal-line-item');
    items.forEach(it => it.classList.remove('is-active'));
    signalIdx = (signalIdx + 1) % items.length;
    items[signalIdx].classList.add('is-active');
  }, 8000);
}

// ═══ 8c. FOCUS MODE ═══

export function initFocusMode() {
  const overlay = document.createElement('div');
  overlay.className = 'focus-overlay';
  document.body.appendChild(overlay);

  if (sessionStorage.getItem('miracle_focus_mode') === '1') {
    document.body.classList.add('focus-mode');
  }

  const toggle = () => {
    const on = document.body.classList.toggle('focus-mode');
    sessionStorage.setItem('miracle_focus_mode', on ? '1' : '0');
  };

  document.addEventListener('keydown', e => {
    if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
      toggle();
    }
    if (e.key === 'Escape' && document.body.classList.contains('focus-mode')) {
      document.body.classList.remove('focus-mode');
      sessionStorage.setItem('miracle_focus_mode', '0');
    }
  });

  return toggle;
}

// ═══ BOTTOM NAV (scroll hide/show) ═══

export function initScrollNav() {
  const nav = document.querySelector('.bottom-nav');
  if (!nav) return;
  let lastY = 0;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      if (nav.classList.contains('is-retracted')) {
        ticking = false;
        return;
      }
      const y = window.scrollY;
      if (y > lastY + 8 && y > 60) {
        nav.classList.add('is-hidden');
      } else if (y < lastY - 4) {
        nav.classList.remove('is-hidden');
      }
      lastY = y;
      ticking = false;
    });
  }, { passive: true });
}

// ═══ OFFLINE INDICATOR ═══

export function initOfflineIndicator() {
  const bar = document.createElement('div');
  bar.className = 'offline-bar';
  bar.textContent = 'offline — changes saved locally';
  document.body.prepend(bar);

  const update = () => {
    bar.classList.toggle('is-visible', !navigator.onLine);
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// ═══ SPARKLE SHOWER ═══
// One-shot emerald confetti, triggered by tapping the MIRACLE brand.

export function sparkleShower() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'sparkle-layer';
  document.body.appendChild(layer);
  for (let i = 0; i < 90; i++) {
    const s = document.createElement('span');
    s.className = 'sparkle-dot';
    s.style.cssText = `
      left: ${Math.random() * 100}vw;
      top: ${-10 - Math.random() * 60}px;
      width: ${2 + Math.random() * 7}px;
      height: ${2 + Math.random() * 7}px;
      animation-delay: ${Math.random() * 1400}ms;
      animation-duration: ${3200 + Math.random() * 2400}ms;
      --drift: ${(Math.random() - 0.5) * 140}px;
      --rot: ${(Math.random() - 0.5) * 360}deg;
    `;
    layer.appendChild(s);
  }
  setTimeout(() => layer.remove(), 6000);
}

// ═══ RIPPLE EFFECT ═══

export function initRipple() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn.is-primary');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.style.cssText = `
      width:${size}px; height:${size}px;
      left:${e.clientX - rect.left - size/2}px;
      top:${e.clientY - rect.top - size/2}px;
    `;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 450);
  });
}
