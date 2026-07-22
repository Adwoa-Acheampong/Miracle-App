// focus.js — Pomodoro / focus session timer with 5 modes, ring viz, XP, IDB persistence.

import { all, put, get, ulid } from '../store.js';
import { icon } from '../icons.js';
import { navigate } from '../router.js';

import { esc } from '../util/esc.js';
// ═══ MODE CONFIG ═══

const MODES = {
  deep:   { label: 'DEEP WORK', icon: 'target',   color: 'var(--color-sapphire)', rgb: '74,127,165', defaultMin: 50, blurb: 'unbroken execution', xpBonus: 3 },
  prayer: { label: 'PRAYER',    icon: 'flower',   color: 'var(--color-violet)',   rgb: '123,94,167', defaultMin: 20, blurb: 'dedicated intercession', xpBonus: 5 },
  bible:  { label: 'BIBLE',     icon: 'scroll',   color: 'var(--color-sapphire)', rgb: '74,127,165', defaultMin: 30, blurb: 'reading + meditation', xpBonus: 5 },
  build:  { label: 'BUILD',     icon: 'compass',  color: 'var(--color-emerald)',  rgb: '16,185,129', defaultMin: 45, blurb: 'project construction', xpBonus: 2 },
  rest:   { label: 'SELAH',     icon: 'sun',      color: 'var(--color-gold)',     rgb: '212,162,78', defaultMin: 10, blurb: 'stillness · breath', xpBonus: 1 },
};

const DURATIONS = [5, 10, 15, 20, 25, 30, 45, 50, 60];

// ═══ MODULE STATE ═══

let timerState   = 'idle';
let timerMode    = 'deep';
let totalSecs    = MODES.deep.defaultMin * 60;
let remainSecs   = totalSecs;
let elapsedSecs  = 0;
let tickInterval = null;
let sessionStart = null;
let linkedTaskId = null;
let linkedTaskLabel = null;
let rootEl = null;
let cleanupCallbacks = [];

const CIRC = 2 * Math.PI * 110;

// ═══ RENDER ═══

export async function render() {
  // Restore any in-flight session from sessionStorage
  restoreFromStorage();

  rootEl = document.createElement('div');
  rootEl.className = 'page focus-page';

  const [sessions, openTasks] = await Promise.all([
    all('focusSessions').catch(() => []),
    all('tasks').then(t => t.filter(x => !x.completedAt)).catch(() => []),
  ]);

  paint(sessions, openTasks);
  attachHandlers(sessions, openTasks);
  attachKeyboard();
  attachVisibility();
  attachNavigationCleanup();
  return rootEl;
}

function paint(sessions, openTasks) {
  const m = MODES[timerMode];
  const today = todayIso();
  const todaySess = sessions.filter(s => (s.startedAt || '').startsWith(today));
  const weekSess  = sessions.filter(s => isThisWeek(s.startedAt));
  const stats = computeStats(sessions);

  rootEl.innerHTML = `
    <div class="focus-header">
      <h1 class="page-title">focus</h1>
      <span class="page-meta">${sessions.length} sessions logged · ${stats.streak} day streak</span>
    </div>

    <div class="focus-mode-bar">
      ${Object.entries(MODES).map(([k, v]) => `
        <button class="focus-mode-pill ${k === timerMode ? 'is-active' : ''}" data-mode="${k}" style="--c:${v.color}; --rgb:${v.rgb}">
          <span class="focus-mode-icon">${icon(v.icon, { size: 14 })}</span>
          <span>${v.label}</span>
        </button>
      `).join('')}
    </div>

    <div class="focus-task-picker" id="task-picker">
      <button class="task-picker-head" id="task-picker-toggle">
        <span>${linkedTaskLabel ? `linked: ${esc(linkedTaskLabel)}` : 'link to a task (optional)'}</span>
        <span class="task-picker-chevron">▸</span>
      </button>
      <div class="task-picker-body" hidden>
        <button class="task-pill ${!linkedTaskId ? 'is-active' : ''}" data-task-id="">+ no task · free session</button>
        ${openTasks.slice(0, 12).map(t => `
          <button class="task-pill ${t.id === linkedTaskId ? 'is-active' : ''}" data-task-id="${t.id}" data-task-label="${esc(t.title || '')}">
            ${esc(t.title || '(untitled)')}${t.priority ? ` · ${esc(t.priority)}` : ''}
          </button>
        `).join('')}
      </div>
    </div>

    <div class="focus-arena" data-mode="${timerMode}" style="--c:${m.color}; --rgb:${m.rgb}">
      <div class="arena-bg" data-mode="${timerMode}"></div>
      <button class="arena-fullscreen" id="fs-toggle" title="full screen" aria-label="full screen">⛶</button>

      <svg class="focus-ring-svg" viewBox="0 0 260 260" aria-hidden="true">
        <circle class="focus-ring-track" cx="130" cy="130" r="110" stroke-width="8"/>
        <circle class="focus-ring-progress ${timerState === 'idle' ? 'is-idle' : ''}"
                cx="130" cy="130" r="110" stroke-width="8"
                stroke="${m.color}"
                stroke-dasharray="${CIRC}"
                stroke-dashoffset="${timerState === 'idle' ? 0 : CIRC * (1 - remainSecs / totalSecs)}"
                stroke-linecap="round" id="ring-progress"/>
        <g class="burst-group" id="burst-group" aria-hidden="true"></g>
      </svg>
      <div class="focus-time-wrap">
        <div class="focus-time" id="time-display">${formatMMSS(remainSecs)}</div>
        <div class="focus-mode-label" style="color:${m.color}">${m.label}</div>
        ${linkedTaskLabel ? `<div class="focus-task-label" style="color:${m.color}">${esc(linkedTaskLabel.slice(0, 30))}</div>` : `<div class="focus-blurb">${m.blurb}</div>`}
      </div>
    </div>

    <div class="duration-bar">
      ${DURATIONS.map(d => `
        <button class="duration-btn ${d === Math.round(totalSecs / 60) ? 'is-active' : ''}" data-dur="${d}" style="--c:${m.color}">${d}</button>
      `).join('')}
      <button class="duration-btn duration-custom" id="duration-custom">+ custom</button>
    </div>

    <div class="focus-controls">
      <button class="focus-btn-start" id="btn-start" style="--c:${m.color}; --rgb:${m.rgb}">
        ${timerState === 'running' ? '⏸ PAUSE' : timerState === 'paused' ? '▶ RESUME' : '▶ START'}
      </button>
      <button class="focus-btn-stop" id="btn-stop" ${timerState === 'idle' ? 'disabled' : ''}>■ STOP</button>
    </div>

    <div id="reflection-mount"></div>

    <div class="focus-stats">
      <div class="focus-stat-card">
        <div class="fs-card-label">TODAY</div>
        <div class="fs-card-num">${formatHM(stats.todayMin)}</div>
        <div class="fs-card-sub">${stats.todayComplete}/${todaySess.length} sessions</div>
        ${stats.dominantToday ? `
          <div class="fs-dominant">
            <span class="fs-dom-icon" style="color:${MODES[stats.dominantToday].color}">${icon(MODES[stats.dominantToday].icon, { size: 12 })}</span>
            <span>${MODES[stats.dominantToday].label.toLowerCase()}</span>
          </div>
        ` : ''}
        <div class="fs-mini-bars">
          ${stats.last6.map(s => `
            <span class="fs-mb" style="height:${Math.max(8, Math.min(100, (s.mins/60)*100))}%; background:${MODES[s.mode]?.color || '#888'}" title="${esc(s.mode)} · ${s.mins}m"></span>
          `).join('')}
        </div>
      </div>
      <div class="focus-stat-card">
        <div class="fs-card-label">THIS WEEK</div>
        <div class="fs-card-num">${formatHM(stats.weekMin)}</div>
        <div class="fs-card-sub">${stats.streak} day streak <span style="color:var(--color-clay)">🔥</span></div>
        ${stats.bestThisWeek ? `<div class="fs-best">best: ${stats.bestThisWeek}m ${MODES[stats.bestThisWeekMode]?.label?.toLowerCase() || ''}</div>` : ''}
        <div class="fs-week-bars">
          ${stats.weekBars.map(b => `
            <span class="fs-wb" title="${b.day} · ${b.mins}m">
              <span class="fs-wb-fill" style="height:${Math.min(100, (b.mins / Math.max(1, stats.weekBarMax)) * 100)}%; background:${MODES[b.mode]?.color || 'rgba(255,255,255,0.08)'}"></span>
              <span class="fs-wb-day">${b.day}</span>
            </span>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="focus-session-log">
      <div class="fs-log-head">
        <span class="fs-log-title">session log</span>
        <span class="fs-log-count">${sessions.length}</span>
      </div>
      ${sessions.length === 0 ? renderEmptyLog() : renderSessionList(sessions)}
    </div>
  `;
}

function renderEmptyLog() {
  return `
    <div class="fs-empty">
      <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:64px;height:64px">
        <circle cx="40" cy="40" r="24" fill="none" stroke="var(--color-sapphire)" stroke-width="1.5" opacity="0.4"/>
        <circle cx="40" cy="40" r="3" fill="var(--color-sapphire)" opacity="0.7"/>
        <line x1="40" y1="40" x2="40" y2="22" stroke="var(--color-sapphire)" stroke-width="1.5" opacity="0.6"/>
        <line x1="40" y1="40" x2="54" y2="44" stroke="var(--color-sapphire)" stroke-width="1.5" opacity="0.6"/>
      </svg>
      <div class="fs-empty-title">your first session is waiting</div>
      <div class="fs-empty-hint">choose a mode above</div>
    </div>
  `;
}

function renderSessionList(sessions) {
  const sorted = sessions.slice().sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  const byDate = {};
  for (const s of sorted.slice(0, 60)) {
    const d = (s.startedAt || '').slice(0, 10) || 'undated';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(s);
  }
  return `
    <div class="fs-log-list">
      ${Object.entries(byDate).map(([d, group]) => `
        <div class="fs-date-header">${formatDateHeader(d)}</div>
        ${group.map(s => {
          const m = MODES[s.mode] || MODES.deep;
          const mins = Math.round((s.elapsedSecs || 0) / 60);
          return `
            <div class="focus-session-row" data-id="${s.id}">
              <span class="fs-row-icon" style="color:${m.color}">${icon(m.icon, { size: 13 })}</span>
              <span class="fs-row-label">${esc(s.taskLabel || 'free session')}</span>
              <span class="fs-row-elapsed">${mins}m</span>
              <span class="fs-row-time">${formatTime(s.startedAt)}</span>
              <span class="fs-row-dot ${s.status === 'completed' ? 'is-ok' : 'is-warn'}"></span>
              ${s.status === 'completed' && s.xp ? `<span class="fs-row-xp">+${s.xp} XP</span>` : ''}
            </div>
          `;
        }).join('')}
      `).join('')}
    </div>
  `;
}

// ═══ HANDLERS ═══

function attachHandlers(sessions, openTasks) {
  rootEl.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (timerState === 'running' || timerState === 'paused') {
        if (!confirm('switching mode will stop the current session. continue?')) return;
        stopTimer('interrupted');
      }
      timerMode = btn.dataset.mode;
      totalSecs = MODES[timerMode].defaultMin * 60;
      remainSecs = totalSecs;
      elapsedSecs = 0;
      const fresh = await all('focusSessions').catch(() => []);
      paint(fresh, openTasks);
      attachHandlers(fresh, openTasks);
    });
  });

  rootEl.querySelectorAll('.duration-btn[data-dur]').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = Number(btn.dataset.dur);
      if (isNaN(d)) return;
      totalSecs = d * 60;
      remainSecs = totalSecs;
      elapsedSecs = 0;
      timerState = 'idle';
      refreshUI();
    });
  });

  rootEl.querySelector('#duration-custom')?.addEventListener('click', () => {
    const v = parseInt(prompt('custom duration (1–120 min):'), 10);
    if (!v || v < 1 || v > 120) return;
    totalSecs = v * 60;
    remainSecs = totalSecs;
    elapsedSecs = 0;
    timerState = 'idle';
    refreshUI();
  });

  rootEl.querySelector('#task-picker-toggle')?.addEventListener('click', () => {
    const body = rootEl.querySelector('.task-picker-body');
    const ch = rootEl.querySelector('.task-picker-chevron');
    if (body.hasAttribute('hidden')) { body.removeAttribute('hidden'); ch.textContent = '▾'; }
    else { body.setAttribute('hidden', ''); ch.textContent = '▸'; }
  });
  rootEl.querySelectorAll('.task-pill').forEach(p => {
    p.addEventListener('click', () => {
      linkedTaskId = p.dataset.taskId || null;
      linkedTaskLabel = p.dataset.taskLabel || null;
      refreshUI();
    });
  });

  rootEl.querySelector('#btn-start')?.addEventListener('click', () => toggleStart());
  rootEl.querySelector('#btn-stop')?.addEventListener('click', () => onStopClicked());
  rootEl.querySelector('#fs-toggle')?.addEventListener('click', () => toggleFullscreen());
}

function refreshUI() {
  const btn = rootEl.querySelector('#btn-start');
  const stopBtn = rootEl.querySelector('#btn-stop');
  const time = rootEl.querySelector('#time-display');
  const ring = rootEl.querySelector('#ring-progress');
  if (btn) btn.textContent = timerState === 'running' ? '⏸ PAUSE' : timerState === 'paused' ? '▶ RESUME' : '▶ START';
  if (stopBtn) stopBtn.disabled = timerState === 'idle';
  if (time) time.textContent = formatMMSS(remainSecs);
  if (ring) {
    ring.setAttribute('stroke-dashoffset', String(timerState === 'idle' ? 0 : CIRC * (1 - remainSecs / totalSecs)));
    ring.classList.toggle('is-idle', timerState === 'idle');
  }
  // Active duration button
  rootEl.querySelectorAll('.duration-btn[data-dur]').forEach(b => {
    b.classList.toggle('is-active', Number(b.dataset.dur) === Math.round(totalSecs / 60));
  });
  // Arena task label
  const labelEl = rootEl.querySelector('.focus-task-label, .focus-blurb');
  if (labelEl) {
    if (linkedTaskLabel) {
      labelEl.outerHTML = `<div class="focus-task-label" style="color:${MODES[timerMode].color}">${esc(linkedTaskLabel.slice(0, 30))}</div>`;
    } else {
      labelEl.outerHTML = `<div class="focus-blurb">${MODES[timerMode].blurb}</div>`;
    }
  }
  // Task picker head label
  const pickerHead = rootEl.querySelector('#task-picker-toggle span');
  if (pickerHead) pickerHead.textContent = linkedTaskLabel ? `linked: ${linkedTaskLabel}` : 'link to a task (optional)';
}

// ═══ TIMER ENGINE ═══

function toggleStart() {
  if (timerState === 'idle' || timerState === 'done') startTimer();
  else if (timerState === 'running') pauseTimer();
  else if (timerState === 'paused') resumeTimer();
}

function startTimer() {
  if (timerState === 'idle' || timerState === 'done') {
    elapsedSecs = 0;
    remainSecs = totalSecs;
    sessionStart = new Date().toISOString();
  }
  timerState = 'running';
  storeSessionInProgress();
  tickInterval = setInterval(tick, 1000);
  refreshUI();
}

function pauseTimer() {
  timerState = 'paused';
  clearInterval(tickInterval);
  tickInterval = null;
  storeSessionInProgress();
  refreshUI();
}

function resumeTimer() {
  timerState = 'running';
  tickInterval = setInterval(tick, 1000);
  refreshUI();
}

function tick() {
  remainSecs--;
  elapsedSecs++;
  storeSessionInProgress();
  // Smooth ring update
  const ring = rootEl?.querySelector('#ring-progress');
  if (ring) ring.setAttribute('stroke-dashoffset', String(CIRC * (1 - remainSecs / totalSecs)));
  const time = rootEl?.querySelector('#time-display');
  if (time) time.textContent = formatMMSS(remainSecs);
  if (remainSecs <= 0) {
    clearInterval(tickInterval);
    tickInterval = null;
    timerState = 'done';
    try { playChime(); } catch { /* ignore */ }
    showCompletionBurst();
    saveSession('completed').then(() => showReflection('completed'));
    refreshUI();
  }
}

async function onStopClicked() {
  if (timerState === 'idle') return;
  if (elapsedSecs > 60) {
    if (!confirm('end session early?')) return;
  }
  stopTimer('interrupted');
}

function stopTimer(status) {
  clearInterval(tickInterval);
  tickInterval = null;
  timerState = 'idle';
  try { if (status === 'interrupted') playSingleTone(440); } catch { /* ignore */ }
  if (elapsedSecs > 0) {
    saveSession(status).then(() => showReflection(status));
  }
  refreshUI();
}

// ═══ COMPLETION BURST ═══

function showCompletionBurst() {
  const burst = rootEl?.querySelector('#burst-group');
  if (!burst) return;
  burst.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const dx = Math.cos(angle) * 80;
    const dy = Math.sin(angle) * 80;
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', '130');
    dot.setAttribute('cy', '130');
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', 'var(--color-gold)');
    dot.style.setProperty('--dx', `${dx}px`);
    dot.style.setProperty('--dy', `${dy}px`);
    dot.style.animation = `burst-dot 600ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards`;
    burst.appendChild(dot);
  }
  const time = rootEl?.querySelector('#time-display');
  if (time) {
    const orig = time.textContent;
    time.textContent = '✦ done';
    setTimeout(() => {
      time.textContent = orig === '✦ done' ? '00:00' : orig;
    }, 2000);
  }
  setTimeout(() => { burst.innerHTML = ''; }, 700);
}

// ═══ PERSISTENCE ═══

async function saveSession(status) {
  const xp = computeXp(elapsedSecs, status, timerMode);
  const entry = {
    id: ulid(),
    taskId: linkedTaskId || null,
    taskLabel: linkedTaskLabel || '',
    mode: timerMode,
    durationMins: Math.round(totalSecs / 60),
    elapsedSecs,
    status,
    startedAt: sessionStart || new Date().toISOString(),
    endedAt: new Date().toISOString(),
    notes: '',
    xp,
  };
  await put('focusSessions', entry);
  sessionStorage.removeItem('miracle_focus_inflight');
  return entry;
}

function computeXp(secs, status, mode) {
  const base = Math.floor(secs / 60);
  const bonus = status === 'completed' ? 10 : 0;
  const modeBonus = (MODES[mode] || MODES.deep).xpBonus;
  return base + bonus + modeBonus;
}

function storeSessionInProgress() {
  try {
    sessionStorage.setItem('miracle_focus_inflight', JSON.stringify({
      mode: timerMode,
      totalSecs, remainSecs, elapsedSecs,
      startedAt: sessionStart,
      state: timerState,
      linkedTaskId, linkedTaskLabel,
      ts: Date.now(),
    }));
  } catch { /* ignore */ }
}

function restoreFromStorage() {
  try {
    const raw = sessionStorage.getItem('miracle_focus_inflight');
    if (!raw) return;
    const r = JSON.parse(raw);
    if (!r || !r.state) return;
    timerMode = r.mode || 'deep';
    totalSecs = r.totalSecs || MODES.deep.defaultMin * 60;
    remainSecs = r.remainSecs ?? totalSecs;
    elapsedSecs = r.elapsedSecs || 0;
    sessionStart = r.startedAt || null;
    linkedTaskId = r.linkedTaskId || null;
    linkedTaskLabel = r.linkedTaskLabel || null;
    timerState = r.state === 'running' ? 'paused' : r.state; // never auto-resume on reload
  } catch { /* ignore */ }
}

// ═══ REFLECTION ═══

async function showReflection(status) {
  const mount = rootEl?.querySelector('#reflection-mount');
  if (!mount) return;
  const xp = computeXp(elapsedSecs, status, timerMode);
  const m = MODES[timerMode];
  mount.innerHTML = `
    <div class="focus-reflection" id="reflection-card">
      <div class="reflection-head">
        <span style="color:${m.color}">${icon(m.icon, { size: 14 })}</span>
        <span class="reflection-title">${m.label} · ${Math.round(elapsedSecs / 60)}m ${linkedTaskLabel ? '· ' + esc(linkedTaskLabel) : ''}</span>
      </div>
      <textarea id="reflection-notes" placeholder="what did you accomplish? (optional)" rows="3"></textarea>
      <div class="reflection-foot">
        <span class="reflection-xp">+<span class="xp-num" data-target="${xp}">0</span> XP earned</span>
        <div class="reflection-actions">
          <button class="btn" id="ref-discard">× discard</button>
          <button class="btn is-primary" id="ref-save" style="background:${m.color}; color:#000;">✦ save session</button>
        </div>
      </div>
    </div>
  `;
  animateXp(mount.querySelector('.xp-num'), xp);

  // Find the just-saved session (last entry) so we can attach notes if user types
  const latest = (await all('focusSessions')).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))[0];

  mount.querySelector('#ref-save')?.addEventListener('click', async () => {
    if (latest) {
      latest.notes = mount.querySelector('#reflection-notes').value;
      await put('focusSessions', latest);
    }
    mount.innerHTML = '';
    // refresh stats
    const fresh = await all('focusSessions').catch(() => []);
    const openTasks = await all('tasks').then(t => t.filter(x => !x.completedAt)).catch(() => []);
    paint(fresh, openTasks);
    attachHandlers(fresh, openTasks);
  });
  mount.querySelector('#ref-discard')?.addEventListener('click', () => { mount.innerHTML = ''; });
}

function animateXp(el, target) {
  if (!el) return;
  const start = performance.now();
  const dur = 700;
  function step(now) {
    const t = Math.min(1, (now - start) / dur);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(target * ease));
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = String(target);
  }
  requestAnimationFrame(step);
}

// ═══ AUDIO ═══

function playChime() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.3);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.3 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.3 + 1.2);
    osc.start(ctx.currentTime + i * 0.3);
    osc.stop(ctx.currentTime + i * 0.3 + 1.2);
  });
}

function playSingleTone(freq) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
}

// ═══ FULLSCREEN ═══

function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      document.body.classList.add('focus-fullscreen');
    } else {
      document.exitFullscreen?.();
      document.body.classList.remove('focus-fullscreen');
    }
  } catch { /* ignore */ }
}

document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('focus-fullscreen');
});

// ═══ KEYBOARD ═══

function attachKeyboard() {
  const handler = e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    if (e.key === ' ') { e.preventDefault(); toggleStart(); }
    if (e.key === 'Escape' && timerState !== 'idle') onStopClicked();
  };
  document.addEventListener('keydown', handler);
  cleanupCallbacks.push(() => document.removeEventListener('keydown', handler));
}

// ═══ VISIBILITY (tab switch reconciliation) ═══

let hiddenAt = null;
function attachVisibility() {
  const handler = () => {
    if (document.hidden && timerState === 'running') {
      hiddenAt = Date.now();
    }
    if (!document.hidden && hiddenAt && timerState === 'running') {
      const delta = Math.floor((Date.now() - hiddenAt) / 1000);
      hiddenAt = null;
      if (delta > 0) {
        remainSecs = Math.max(0, remainSecs - delta);
        elapsedSecs += delta;
        if (remainSecs <= 0) {
          clearInterval(tickInterval); tickInterval = null;
          timerState = 'done';
          try { playChime(); } catch {}
          showCompletionBurst();
          saveSession('completed').then(() => showReflection('completed'));
        }
        refreshUI();
      }
    }
  };
  document.addEventListener('visibilitychange', handler);
  cleanupCallbacks.push(() => document.removeEventListener('visibilitychange', handler));
}

// ═══ CLEANUP ON NAV AWAY ═══

function attachNavigationCleanup() {
  const handler = () => {
    if (location.hash.startsWith('#/focus')) return; // still on focus
    // pause (not stop) if running so user doesn't lose session
    if (timerState === 'running') {
      pauseTimer();
    }
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
    cleanupCallbacks.forEach(fn => { try { fn(); } catch {} });
    cleanupCallbacks = [];
    window.removeEventListener('hashchange', handler);
  };
  window.addEventListener('hashchange', handler);
}

// ═══ STATS ═══

function computeStats(sessions) {
  const today = todayIso();
  const todaySess = sessions.filter(s => (s.startedAt || '').startsWith(today));
  const todayMin = Math.round(todaySess.reduce((s, x) => s + (x.elapsedSecs || 0), 0) / 60);
  const todayComplete = todaySess.filter(s => s.status === 'completed').length;
  const last6 = sessions.slice().sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '')).slice(0, 6)
    .map(s => ({ mode: s.mode || 'deep', mins: Math.round((s.elapsedSecs || 0) / 60) }))
    .reverse();
  // Dominant mode today
  const modeTotals = {};
  todaySess.forEach(s => { modeTotals[s.mode] = (modeTotals[s.mode] || 0) + (s.elapsedSecs || 0); });
  const dominantToday = Object.entries(modeTotals).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Week stats
  const weekSess = sessions.filter(s => isThisWeek(s.startedAt));
  const weekMin = Math.round(weekSess.reduce((s, x) => s + (x.elapsedSecs || 0), 0) / 60);
  const bestSess = weekSess.filter(s => s.status === 'completed').sort((a, b) => (b.elapsedSecs || 0) - (a.elapsedSecs || 0))[0];
  const bestThisWeek = bestSess ? Math.round(bestSess.elapsedSecs / 60) : 0;
  const bestThisWeekMode = bestSess?.mode;

  // Streak (consecutive days with ≥1 completed)
  const completedDates = new Set(sessions.filter(s => s.status === 'completed').map(s => (s.startedAt || '').slice(0, 10)));
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (completedDates.has(d.toISOString().slice(0, 10))) streak++;
    else if (i > 0) break;
  }

  // Week bars Mon–Sun (7 days back from today, oldest first)
  const weekBars = [];
  const dayLabels = ['m','t','w','t','f','s','s'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const dayName = dayLabels[(d.getDay() + 6) % 7];
    const daySess = sessions.filter(s => (s.startedAt || '').startsWith(iso));
    const mins = Math.round(daySess.reduce((sum, x) => sum + (x.elapsedSecs || 0), 0) / 60);
    const totals = {};
    daySess.forEach(s => { totals[s.mode] = (totals[s.mode] || 0) + (s.elapsedSecs || 0); });
    const dominantMode = Object.entries(totals).sort((a, b) => b[1] - a[1])[0]?.[0];
    weekBars.push({ day: dayName, mins, mode: dominantMode });
  }
  const weekBarMax = Math.max(1, ...weekBars.map(b => b.mins));

  return { todayMin, todayComplete, last6, dominantToday, weekMin, streak, bestThisWeek, bestThisWeekMode, weekBars, weekBarMax };
}

// ═══ UTILS ═══

function todayIso() { return new Date().toISOString().slice(0, 10); }
function isThisWeek(iso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Date.now() - t < 7 * 86400000;
}
function formatMMSS(s) {
  s = Math.max(0, s);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function formatHM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}
function formatDateHeader(d) {
  if (d === 'undated') return 'undated';
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toLowerCase();
  } catch { return d; }
}
