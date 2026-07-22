// notifications.js — Cross-platform notification layer (Web Notifications API +
// in-app toast fallback). Surfaces streak-at-risk, upcoming events, and milestones.

import { all, get } from './store.js';

import { esc } from './util/esc.js';
const LS_OPT = 'miracle_notifications';

export function isSupported() {
  return 'Notification' in window;
}

export function permission() {
  return isSupported() ? Notification.permission : 'unsupported';
}

export async function requestPermission() {
  if (!isSupported()) return 'unsupported';
  try {
    const p = await Notification.requestPermission();
    return p;
  } catch { return 'denied'; }
}

export function isEnabled() {
  return localStorage.getItem(LS_OPT) === 'on';
}

export function setEnabled(on) {
  localStorage.setItem(LS_OPT, on ? 'on' : 'off');
}

// Send a notification — uses Web API when available, otherwise drops a toast.
export function notify(title, opts = {}) {
  if (!isEnabled()) return;
  const body = opts.body || '';
  const icon = opts.icon || './assets/favicon.svg';
  if (isSupported() && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body,
        icon,
        badge: icon,
        tag: opts.tag || 'miracle',
        renotify: false,
        silent: opts.silent || false,
      });
      if (opts.onClick) n.onclick = () => { window.focus(); opts.onClick(); };
      return n;
    } catch { /* fall through to toast */ }
  }
  // In-app toast fallback
  showToast(title, body);
}

function showToast(title, body) {
  const t = document.createElement('div');
  t.className = 'mr-toast';
  t.innerHTML = `
    <div class="mr-toast-title">${esc(title)}</div>
    ${body ? `<div class="mr-toast-body">${esc(body)}</div>` : ''}
  `;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('is-leaving'), 4200);
  setTimeout(() => t.remove(), 4700);
}

// Background watchers — surface notifications for time-bounded triggers
export function initNotificationWatchers() {
  if (!isEnabled()) return;
  // Streak-at-risk after 8pm (re-uses the rewards.checkStreakWarnings logic)
  setInterval(checkStreakRiskNotify, 30 * 60 * 1000);
  // Upcoming events within 15 minutes
  setInterval(checkUpcomingEvent, 60 * 1000);
}

async function checkStreakRiskNotify() {
  if (!isEnabled()) return;
  if (new Date().getHours() < 20) return;
  const today = new Date().toISOString().slice(0, 10);
  const atRisk = [];
  for (const d of ['dreams', 'ideas', 'bible', 'prayer', 'fasting', 'plans', 'projects', 'tasks',
    'schedule', 'finance', 'meals', 'testimony', 'music', 'people', 'books', 'blog', 'quizzes']) {
    try {
      const s = JSON.parse(localStorage.getItem(`miracle_streaks_${d}`));
      if (s && s.current > 0 && s.lastDate !== today) atRisk.push(d);
    } catch {}
  }
  if (atRisk.length === 0) return;
  const k = 'miracle_streak_notif_' + today;
  if (localStorage.getItem(k)) return;
  localStorage.setItem(k, '1');
  notify('streak at risk', { body: `${atRisk.length} streak${atRisk.length > 1 ? 's' : ''} need an entry tonight — ${atRisk.slice(0, 3).join(', ')}`, tag: 'streak-risk' });
}

async function checkUpcomingEvent() {
  if (!isEnabled()) return;
  try {
    const events = await all('events');
    const now = Date.now();
    for (const e of events) {
      if (!e.startAt || e.completedAt) continue;
      const t = new Date(e.startAt).getTime();
      const minsAway = Math.round((t - now) / 60000);
      if (minsAway < 0 || minsAway > 15) continue;
      const k = 'miracle_event_notif_' + e.id;
      if (localStorage.getItem(k)) continue;
      localStorage.setItem(k, '1');
      notify(`upcoming · ${e.title || 'event'}`, { body: `in ${minsAway} min${minsAway === 1 ? '' : 's'}${e.location ? ' · ' + e.location : ''}`, tag: 'event-' + e.id });
    }
  } catch {}
}
