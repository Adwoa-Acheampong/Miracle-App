// MODULE 4 — Psychological Reward Architecture
// Streak engine, momentum meter, completion bias, open loops

import { all } from './store.js';
import { icon } from './icons.js';
import { navigate } from './router.js';

import { esc } from './util/esc.js';
const DOMAIN_STORES = {
  dreams: 'dreams', ideas: 'ideas', bible: 'bible', prayer: 'prayers',
  fasting: 'fasts', plans: 'plans', projects: 'projects', tasks: 'tasks',
  schedule: 'events', finance: 'transactions', meals: 'meals',
  testimony: 'testimonies', music: 'music', people: 'people',
  books: 'books', blog: 'blogs', quizzes: 'quizzes',
};

const DOMAIN_COLORS = {
  dreams: '#19C58F', ideas: '#EFD18A', bible: '#D7A94D', plans: '#19C58F',
  projects: '#19C58F', prayer: '#EFD18A', fasting: '#D7A94D', tasks: '#F7F1E5',
  schedule: '#19C58F', finance: '#19C58F', people: '#EFD18A',
  testimony: '#D7A94D', music: '#EFD18A', books: '#D7A94D',
  blog: '#F7F1E5', quizzes: '#19C58F', meals: '#EFD18A',
};

const ACHIEVEMENT_KEY = 'miracle_sparks_v1';
const ACHIEVEMENTS = {
  seat_ready: {
    title: 'Seat ready',
    detail: 'Your Miracle home is open.',
    iconName: 'sparkles',
  },
  first_entry: {
    title: 'First spark',
    detail: 'You saved your first real entry.',
    iconName: 'sparkles',
  },
  first_prayer: {
    title: 'Altar lit',
    detail: 'Your first prayer request is standing.',
    iconName: 'flame',
  },
  first_fasting: {
    title: 'Consecration marked',
    detail: 'Your first fast is recorded with purpose.',
    iconName: 'moon',
  },
  first_bible: {
    title: 'Word planted',
    detail: 'Your first scripture note is in the soil.',
    iconName: 'scroll',
  },
  first_tasks: {
    title: 'Loop named',
    detail: 'Your first next action has a place.',
    iconName: 'list-checks',
  },
  first_books: {
    title: 'Page opened',
    detail: 'Your reading shelf has begun.',
    iconName: 'book-open',
  },
  first_build: {
    title: 'Builder spark',
    detail: 'An idea, plan, or project has entered the workshop.',
    iconName: 'target',
  },
  rhythm_3: {
    title: 'Three-day thread',
    detail: 'A rhythm is forming. Keep it light, keep it real.',
    iconName: 'calendar',
  },
  rhythm_7: {
    title: 'Week woven',
    detail: 'Seven days of return in one lane.',
    iconName: 'crown',
  },
};

const DOMAIN_ACHIEVEMENTS = {
  prayer: 'first_prayer',
  fasting: 'first_fasting',
  bible: 'first_bible',
  tasks: 'first_tasks',
  books: 'first_books',
  ideas: 'first_build',
  plans: 'first_build',
  projects: 'first_build',
  blog: 'first_build',
};

// ═══ 4a. STREAK ENGINE ═══

// The reward layer is fed by the habits Miracle already tracks. Saving a real
// entry grants journey energy; the board turns that progress into a daily game.
const JOURNEY_KEY = 'miracle_journey_v1';
const JOURNEY_DAILY_ROLLS = 3;
const JOURNEY_TILES = [
  { label: 'New mercies', short: 'Start', lane: 'mercy', iconName: 'sun', reward: 50, route: '/day', copy: 'A fresh lap and a fresh portion.' },
  { label: 'Today page', short: 'Today', lane: 'today', iconName: 'calendar', reward: 18, route: '/day', copy: 'Presence before pressure.' },
  { label: 'Deep focus', short: 'Focus', lane: 'today', iconName: 'target', reward: 22, route: '/focus', copy: 'One clear block of attention.' },
  { label: 'Grace space', short: 'Grace', lane: 'grace', iconName: 'sparkles', reward: 45, route: '/dashboard', copy: 'No earning required. Receive this one.' },
  { label: 'Close a loop', short: 'Tasks', lane: 'today', iconName: 'list-checks', reward: 20, route: '/tasks', copy: 'Small follow-through compounds.' },
  { label: 'Prayer altar', short: 'Prayer', lane: 'faith', iconName: 'flame', reward: 30, route: '/prayer', copy: 'Carry the matter to the altar.' },
  { label: 'Living word', short: 'Word', lane: 'faith', iconName: 'scroll', reward: 28, route: '/bible', copy: 'Plant one line worth keeping.' },
  { label: 'Wisdom draw', short: 'Wisdom', lane: 'grace', iconName: 'star', reward: 55, route: '/bible', copy: 'A rare spark found on the path.' },
  { label: 'Consecration', short: 'Fast', lane: 'faith', iconName: 'moon', reward: 34, route: '/fasting', copy: 'Make room for what matters most.' },
  { label: 'Testimony', short: 'Testify', lane: 'faith', iconName: 'megaphone', reward: 38, route: '/testimony', copy: 'Remember what God already did.' },
  { label: 'Idea garden', short: 'Ideas', lane: 'build', iconName: 'lightbulb', reward: 24, route: '/ideas', copy: 'Catch the spark before it leaves.' },
  { label: 'Shape a plan', short: 'Plan', lane: 'build', iconName: 'compass', reward: 26, route: '/plans', copy: 'Give the idea a faithful shape.' },
  { label: 'Builder bonus', short: 'Build', lane: 'grace', iconName: 'crown', reward: 60, route: '/projects', copy: 'Courage for the work in your hands.' },
  { label: 'Ship a piece', short: 'Project', lane: 'build', iconName: 'target', reward: 32, route: '/projects', copy: 'Movement beats perfect intentions.' },
  { label: 'Publish light', short: 'Publish', lane: 'build', iconName: 'feather', reward: 29, route: '/blog', copy: 'Turn a private lesson into a gift.' },
  { label: 'Steward well', short: 'Finance', lane: 'life', iconName: 'wallet', reward: 26, route: '/finance', copy: 'Care for what passed through your hands.' },
  { label: 'People first', short: 'People', lane: 'life', iconName: 'users', reward: 28, route: '/people', copy: 'Remember the person, not only the task.' },
  { label: 'Sabbath garden', short: 'Rest', lane: 'grace', iconName: 'flower', reward: 48, route: '/day', copy: 'Rest is part of the assignment.' },
  { label: 'Open a page', short: 'Books', lane: 'life', iconName: 'book-open', reward: 22, route: '/books', copy: 'Learn one thing slowly and well.' },
  { label: 'Dream watch', short: 'Dreams', lane: 'life', iconName: 'moon', reward: 25, route: '/dreams', copy: 'Notice what keeps returning.' },
];

const JOURNEY_POSITIONS = (() => {
  const positions = [];
  for (let col = 1; col <= 6; col++) positions.push([6, col]);
  for (let row = 5; row >= 1; row--) positions.push([row, 6]);
  for (let col = 5; col >= 1; col--) positions.push([1, col]);
  for (let row = 2; row <= 5; row++) positions.push([row, 1]);
  return positions;
})();

function loadJourneyState() {
  const today = new Date().toISOString().slice(0, 10);
  const earnedCount = Object.keys(loadAchievements()).length;
  let state;
  try {
    state = JSON.parse(localStorage.getItem(JOURNEY_KEY) || 'null');
  } catch {
    state = null;
  }
  if (!state || typeof state !== 'object') {
    state = {
      position: 0,
      sparks: earnedCount * 80,
      laps: 0,
      rollsLeft: JOURNEY_DAILY_ROLLS,
      rollDay: today,
    };
  }
  if (state.rollDay !== today) {
    state.rollDay = today;
    state.rollsLeft = JOURNEY_DAILY_ROLLS;
  }
  state.position = Math.max(0, Math.min(JOURNEY_TILES.length - 1, Number(state.position) || 0));
  state.sparks = Math.max(0, Number(state.sparks) || 0);
  state.laps = Math.max(0, Number(state.laps) || 0);
  state.rollsLeft = Math.max(0, Math.min(6, Number(state.rollsLeft) || 0));
  saveJourneyState(state);
  return state;
}
function saveJourneyState(state) {
  localStorage.setItem(JOURNEY_KEY, JSON.stringify(state));
}

function grantJourneyProgress(domain) {
  const state = loadJourneyState();
  state.sparks += 15;
  state.rollsLeft = Math.min(6, state.rollsLeft + 1);
  state.lastAction = domain;
  state.lastActionAt = new Date().toISOString();
  saveJourneyState(state);
  window.dispatchEvent(new CustomEvent('miracle:journey', { detail: { state, reason: 'entry' } }));
}

function renderJourneyTile(tile, index, position) {
  const [row, col] = JOURNEY_POSITIONS[index];
  const current = index === position;
  return `
    <button
      class="mj-space mj-lane-${esc(tile.lane)} ${tile.lane === 'grace' ? 'is-special' : ''} ${current ? 'is-current' : ''}"
      type="button"
      style="grid-row:${row};grid-column:${col}"
      data-journey-tile="${index}"
      aria-label="${esc(tile.label)}, ${tile.reward} sparks"
    >
      <span class="mj-space-icon">${icon(tile.iconName, { size: 15 })}</span>
      <strong>${esc(tile.short)}</strong>
      <small>+${tile.reward}</small>
      ${current ? `<span class="mj-token" aria-label="your piece">${icon('star', { size: 10 })}</span>` : ''}
    </button>
  `;
}

function renderCollectibleTiles() {
  const earned = loadAchievements();
  return Object.entries(ACHIEVEMENTS).slice(0, 8).map(([id, achievement]) => {
    const isEarned = !!earned[id];
    return `
      <button class="mj-collectible ${isEarned ? 'is-earned' : 'is-locked'}" type="button" data-spark-tile="${esc(id)}" aria-label="${esc(achievement.title)}, ${isEarned ? 'earned' : 'locked'}">
        <span class="mj-collectible-face">${isEarned ? icon(achievement.iconName, { size: 22 }) : '<b>?</b>'}</span>
        <strong>${esc(achievement.title)}</strong>
        <small>${isEarned ? 'collected' : 'locked'}</small>
      </button>
    `;
  }).join('');
}

export function renderMiracleGame({ momentumHtml = '' } = {}) {
  const state = loadJourneyState();
  const earned = loadAchievements();
  const achievementCount = Object.keys(ACHIEVEMENTS).length;
  const earnedCount = Object.keys(earned).length;
  const nextAchievement = Object.entries(ACHIEVEMENTS).find(([id]) => !earned[id])?.[1];
  return `
    <section class="miracle-journey" data-miracle-game>
      <header class="mj-header">
        <div>
          <span class="mj-kicker">YOUR LIVING GAME</span>
          <h3>Miracle Journey</h3>
          <p>Real follow-through powers every move.</p>
        </div>
        <div class="mj-header-stats" aria-label="Journey status">
          <span><small>SPARKS</small><strong>${icon('sparkles', { size: 13 })}<b data-mj-sparks>${state.sparks}</b></strong></span>
          <span><small>LAPS</small><strong>${icon('refresh-cw', { size: 13 })}<b data-mj-laps>${state.laps}</b></strong></span>
          <span><small>ROLLS</small><strong>${icon('star', { size: 13 })}<b data-mj-rolls-count>${state.rollsLeft}</b></strong></span>
        </div>
      </header>

      <div class="mj-layout">
        <div class="mj-board-shell">
          <div class="mj-board" aria-label="Miracle Journey board">
            <div class="mj-board-center">
              <span class="mj-center-kicker">TODAY'S PATH</span>
              <div class="mj-center-balance">${icon('sparkles', { size: 14 })}<strong data-mj-sparks>${state.sparks}</strong><small>SPARKS</small></div>
              <div class="mj-roll-row">
                <div class="mj-die" data-mj-die data-face="5" aria-hidden="true">
                  ${'<i></i>'.repeat(9)}
                </div>
                <button class="mj-roll" type="button" data-mj-roll ${state.rollsLeft < 1 ? 'disabled' : ''}>
                  <span>${state.rollsLeft < 1 ? 'PATH COMPLETE' : 'ROLL THE PATH'}</span>
                  <small data-mj-rolls>${state.rollsLeft} roll${state.rollsLeft === 1 ? '' : 's'} left</small>
                </button>
              </div>
              <p class="mj-message" data-mj-message aria-live="polite">${state.rollsLeft ? 'Move, reveal, and collect what the day holds.' : 'Come back tomorrow, or complete an action for another roll.'}</p>
            </div>
            ${JOURNEY_TILES.map((tile, index) => renderJourneyTile(tile, index, state.position)).join('')}
          </div>
          <div class="mj-legend" aria-label="Board lanes">
            <span class="is-today">Today</span><span class="is-faith">Faith</span><span class="is-build">Build</span><span class="is-life">Life</span><span class="is-grace">Grace</span>
          </div>
        </div>

        <aside class="mj-album" aria-label="Spark tile album">
          <div class="mj-album-head">
            <div><span>SPARK TILE SET</span><h4>Signs of follow-through</h4></div>
            <strong>${earnedCount}/${achievementCount}</strong>
          </div>
          <div class="mj-set-progress" role="progressbar" aria-label="Spark tile collection" aria-valuemin="0" aria-valuemax="${achievementCount}" aria-valuenow="${earnedCount}"><i style="width:${Math.round((earnedCount / achievementCount) * 100)}%"></i></div>
          <div class="mj-tile-rack">
            ${renderCollectibleTiles()}
          </div>
          <div class="mj-next-tile">
            <span>${icon(nextAchievement?.iconName || 'crown', { size: 17 })}</span>
            <div><small>NEXT TILE</small><strong>${esc(nextAchievement?.title || 'Set complete')}</strong><p>${esc(nextAchievement?.detail || 'Every current spark has been collected.')}</p></div>
          </div>
          ${momentumHtml ? `<div class="mj-momentum">${momentumHtml}</div>` : ''}
        </aside>
      </div>

      <div class="mj-reveal" data-mj-reveal hidden role="status" aria-live="polite">
        <div class="mj-reveal-rays" aria-hidden="true"></div>
        <span class="mj-reveal-icon" data-mj-reveal-icon></span>
        <small>SPACE REVEALED</small>
        <h4 data-mj-reveal-title>Grace space</h4>
        <p data-mj-reveal-copy>Receive this one.</p>
        <strong data-mj-reveal-reward>+45 sparks</strong>
        <button type="button" data-mj-claim>Collect and continue</button>
      </div>
    </section>
  `;
}

function syncJourneyUi(game, state) {
  game.querySelectorAll('[data-mj-sparks]').forEach(el => { el.textContent = String(state.sparks); });
  game.querySelectorAll('[data-mj-laps]').forEach(el => { el.textContent = String(state.laps); });
  game.querySelectorAll('[data-mj-rolls-count]').forEach(el => { el.textContent = String(state.rollsLeft); });
  const rolls = game.querySelector('[data-mj-rolls]');
  if (rolls) rolls.textContent = `${state.rollsLeft} roll${state.rollsLeft === 1 ? '' : 's'} left`;
}

function moveJourneyToken(game, index) {
  game.querySelectorAll('.mj-space.is-current').forEach(space => space.classList.remove('is-current'));
  const target = game.querySelector(`[data-journey-tile="${index}"]`);
  if (!target) return;
  let token = game.querySelector('.mj-token');
  if (!token) {
    token = document.createElement('span');
    token.className = 'mj-token';
    token.setAttribute('aria-label', 'your piece');
    token.innerHTML = icon('star', { size: 10 });
  }
  target.classList.add('is-current');
  target.appendChild(token);
  token.classList.remove('is-hopping');
  void token.offsetWidth;
  token.classList.add('is-hopping');
}

function openJourneyReveal(game, tile) {
  const reveal = game.querySelector('[data-mj-reveal]');
  if (!reveal) return;
  reveal.querySelector('[data-mj-reveal-icon]').innerHTML = icon(tile.iconName, { size: 27 });
  reveal.querySelector('[data-mj-reveal-title]').textContent = tile.label;
  reveal.querySelector('[data-mj-reveal-copy]').textContent = tile.copy;
  reveal.querySelector('[data-mj-reveal-reward]').textContent = `+${tile.reward} sparks`;
  reveal.hidden = false;
  requestAnimationFrame(() => reveal.classList.add('is-open'));
  reveal.querySelector('[data-mj-claim]')?.focus();
}

export function bindMiracleGame(root) {
  const game = root.querySelector('[data-miracle-game]');
  if (!game) return;
  const rollButton = game.querySelector('[data-mj-roll]');
  const message = game.querySelector('[data-mj-message]');
  const die = game.querySelector('[data-mj-die]');
  let pendingTile = null;
  let rolling = false;

  game.querySelectorAll('[data-journey-tile]').forEach(space => {
    space.addEventListener('click', () => {
      const tile = JOURNEY_TILES[Number(space.dataset.journeyTile)];
      if (!tile || !message) return;
      message.textContent = `${tile.label} · ${tile.copy}`;
    });
  });

  game.querySelectorAll('[data-spark-tile]').forEach(tileButton => {
    tileButton.addEventListener('click', () => {
      const achievement = ACHIEVEMENTS[tileButton.dataset.sparkTile];
      if (!achievement || !message) return;
      message.textContent = `${achievement.title} · ${achievement.detail}`;
    });
  });

  rollButton?.addEventListener('click', async () => {
    const state = loadJourneyState();
    if (rolling || state.rollsLeft < 1) return;
    rolling = true;
    state.rollsLeft -= 1;
    saveJourneyState(state);
    syncJourneyUi(game, state);
    rollButton.disabled = true;
    if (message) message.textContent = 'The path is moving…';

    const value = Math.floor(Math.random() * 6) + 1;
    die.dataset.face = String(value);
    die.classList.remove('is-rolling');
    void die.offsetWidth;
    die.classList.add('is-rolling');
    await wait(460);

    for (let step = 0; step < value; step += 1) {
      state.position = (state.position + 1) % JOURNEY_TILES.length;
      if (state.position === 0) {
        state.laps += 1;
        state.sparks += 50;
      }
      moveJourneyToken(game, state.position);
      syncJourneyUi(game, state);
      await wait(210);
    }

    pendingTile = JOURNEY_TILES[state.position];
    saveJourneyState(state);
    if (message) message.textContent = `Landed on ${pendingTile.label}`;
    openJourneyReveal(game, pendingTile);
    rolling = false;
  });

  game.querySelector('[data-mj-claim]')?.addEventListener('click', () => {
    if (!pendingTile) return;
    const state = loadJourneyState();
    state.sparks += pendingTile.reward;
    saveJourneyState(state);
    syncJourneyUi(game, state);
    const reveal = game.querySelector('[data-mj-reveal]');
    reveal?.classList.remove('is-open');
    setTimeout(() => { if (reveal) reveal.hidden = true; }, 240);
    if (message) message.textContent = `${pendingTile.label} added ${pendingTile.reward} sparks.`;
    pendingTile = null;
    launchMiracleFireflies({ count: 18, duration: 2800 });
    if (state.rollsLeft > 0) {
      rollButton.disabled = false;
    } else {
      rollButton.disabled = true;
      rollButton.querySelector('span').textContent = 'PATH COMPLETE';
      if (message) message.textContent = 'Daily path complete. A real action earns another roll.';
    }
    rollButton.focus();
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getStreakKey(domain) { return `miracle_streaks_${domain}`; }

function loadStreak(domain) {
  try {
    return JSON.parse(localStorage.getItem(getStreakKey(domain))) || { current: 0, longest: 0, lastDate: '' };
  } catch { return { current: 0, longest: 0, lastDate: '' }; }
}

function saveStreak(domain, data) {
  localStorage.setItem(getStreakKey(domain), JSON.stringify(data));
}

export function updateStreak(domain) {
  const today = new Date().toISOString().slice(0, 10);
  const s = loadStreak(domain);
  if (s.lastDate === today) return s;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);

  if (s.lastDate === yStr) {
    s.current++;
  } else if (s.lastDate && s.lastDate !== today) {
    s.current = 1;
  } else {
    s.current = 1;
  }
  s.longest = Math.max(s.longest, s.current);
  s.lastDate = today;
  saveStreak(domain, s);
  awardAchievement('first_entry');
  const domainAchievement = DOMAIN_ACHIEVEMENTS[domain];
  if (domainAchievement) awardAchievement(domainAchievement);
  if (s.current >= 3) awardAchievement('rhythm_3');
  if (s.current >= 7) awardAchievement('rhythm_7');
  grantJourneyProgress(domain);
  return s;
}

export function awardAchievement(id) {
  const achievement = ACHIEVEMENTS[id];
  if (!achievement) return false;
  const earned = loadAchievements();
  if (earned[id]) return false;
  earned[id] = new Date().toISOString();
  saveAchievements(earned);
  launchMiracleFireflies({ count: 54, duration: 7600 });
  showAchievementPopup({ id, ...achievement, earnedAt: earned[id] });
  window.dispatchEvent(new CustomEvent('miracle:achievement', { detail: { id, achievement } }));
  return true;
}

export function renderAchievementShelf() {
  const earned = loadAchievements();
  const items = Object.entries(ACHIEVEMENTS);
  const earnedCount = Object.keys(earned).length;
  return `
    <div class="achievement-shelf">
      <div class="achievement-head">
        <span>${icon('sparkles', { size: 15 })} Miracle sparks</span>
        <strong>${earnedCount}/${items.length}</strong>
      </div>
      <div class="achievement-grid">
        ${items.slice(0, 8).map(([id, achievement]) => {
          const isEarned = !!earned[id];
          return `
            <div class="achievement-chip ${isEarned ? 'is-earned' : 'is-locked'}">
              <span>${icon(achievement.iconName, { size: 14 })}</span>
              <div>
                <strong>${esc(achievement.title)}</strong>
                <small>${isEarned ? esc(achievement.detail) : 'not unlocked yet'}</small>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

export function launchMiracleFireflies({ count = 42, duration = 6800 } = {}) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const layer = document.createElement('div');
  layer.className = 'miracle-firefly-layer';
  document.body.appendChild(layer);
  for (let i = 0; i < count; i++) {
    const fly = document.createElement('span');
    fly.className = 'miracle-firefly';
    fly.style.cssText = `
      left:${8 + Math.random() * 84}vw;
      top:${16 + Math.random() * 72}vh;
      animation-delay:${Math.random() * 1600}ms;
      animation-duration:${4200 + Math.random() * 2600}ms;
      --x:${(Math.random() - 0.5) * 120}px;
      --y:${(Math.random() - 0.5) * 140}px;
    `;
    layer.appendChild(fly);
  }
  setTimeout(() => layer.remove(), duration);
}

function loadAchievements() {
  try {
    return JSON.parse(localStorage.getItem(ACHIEVEMENT_KEY)) || {};
  } catch {
    return {};
  }
}

function saveAchievements(earned) {
  localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(earned));
}

function showAchievementPopup(achievement) {
  document.querySelector('.spark-award')?.remove();
  const popup = document.createElement('div');
  popup.className = 'spark-award';
  popup.innerHTML = `
    <span class="spark-award-icon">${icon(achievement.iconName, { size: 18 })}</span>
    <span class="spark-award-copy">
      <small>Miracle spark unlocked</small>
      <strong>${esc(achievement.title)}</strong>
      <em>${esc(achievement.detail)}</em>
    </span>
    <button type="button" class="spark-award-close" aria-label="close">${icon('x', { size: 13 })}</button>
  `;
  popup.querySelector('.spark-award-close').addEventListener('click', () => popup.remove());
  document.body.appendChild(popup);
  setTimeout(() => popup.classList.add('is-leaving'), 6400);
  setTimeout(() => popup.remove(), 6900);
}

export function renderStreakBadge(domain) {
  const s = loadStreak(domain);
  if (s.current < 1) return '';
  return `<span class="streak-display" style="--dom:${DOMAIN_COLORS[domain] || 'var(--emerald)'}">
    <span class="streak-fire">${icon('flame', { size: 12 })}</span>
    <span class="streak-count">${s.current}</span>
  </span>`;
}

export function checkStreakWarnings() {
  const hour = new Date().getHours();
  if (hour < 20) return;
  const today = new Date().toISOString().slice(0, 10);
  const atRisk = [];
  for (const [domain] of Object.entries(DOMAIN_STORES)) {
    const s = loadStreak(domain);
    if (s.current > 0 && s.lastDate !== today) {
      atRisk.push(domain);
    }
  }
  if (atRisk.length === 0) return;
  const existing = document.querySelector('.streak-warning');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'streak-warning';
  el.textContent = `${atRisk.length} streak${atRisk.length > 1 ? 's' : ''} at risk — ${atRisk.slice(0, 3).join(', ')}`;
  el.addEventListener('click', () => { el.remove(); navigate('/dashboard'); });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 15000);
}

// ═══ 4b. MOMENTUM METER ═══

export async function renderMomentumBar() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toISOString().slice(0, 10);
  let count = 0;
  for (const [, store] of Object.entries(DOMAIN_STORES)) {
    try {
      const rows = await all(store);
      count += rows.filter(r => (r.updatedAt || r.createdAt || '') >= weekStr).length;
    } catch { /* skip */ }
  }
  const maxExpected = 50;
  const pct = Math.min(100, Math.round((count / maxExpected) * 100));
  const level = pct <= 30 ? 'low' : pct <= 70 ? 'mid' : 'high';

  return `<div class="momentum-bar">
    <div class="momentum-label">momentum · ${count} entries this week</div>
    <div class="momentum-track">
      <div class="momentum-fill" data-level="${level}" style="width:${pct}%"></div>
    </div>
  </div>`;
}

// ═══ 4c. COMPLETION BIAS ═══

let audioCtx = null;
function playCompletionTone() {
  if (localStorage.getItem('miracle_sound') !== '1') return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  } catch { /* ignore */ }
}

export function triggerCompletionFlash(originEl) {
  playCompletionTone();
  const flash = document.createElement('div');
  flash.className = 'completion-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 700);

  if (originEl) {
    const rect = originEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ['#19C58F', '#0C7E5A', '#EFD18A', '#D7A94D', '#F7F1E5'];
    for (let i = 0; i < 20; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-particle';
      const angle = (Math.PI * 2 * i) / 20;
      const dist = 40 + Math.random() * 60;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 40;
      p.style.cssText = `
        left:${cx}px; top:${cy}px;
        background:${colors[i % colors.length]};
        animation-delay:${Math.random() * 100}ms;
        --dx:${dx}px; --dy:${dy}px;
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }
  }
}

// ═══ 4d. OPEN LOOPS ═══

export async function renderOpenLoops() {
  const loops = [];
  const today = new Date();
  const storeMap = {
    tasks: { store: 'tasks', filter: r => !r.completedAt && r.status !== 'archived', label: r => r.title },
    prayer: { store: 'prayers', filter: r => r.answer === 'pending' || !r.answer, label: r => r.subject },
    plans: { store: 'plans', filter: r => r.status === 'active' && r.phase !== 'sunset', label: r => r.title },
    projects: { store: 'projects', filter: r => r.status === 'active' && r.phase !== 'maintain', label: r => r.title },
    dreams: { store: 'dreams', filter: r => r.status === 'active' && !r.fulfilledOn, label: r => r.title },
  };

  for (const [domain, spec] of Object.entries(storeMap)) {
    try {
      const rows = await all(spec.store);
      for (const r of rows.filter(spec.filter)) {
        const created = new Date(r.createdAt || r.startedOn || r.date || today);
        const daysOpen = Math.floor((today - created) / 86400000);
        loops.push({
          domain,
          store: spec.store,
          id: r.id,
          title: spec.label(r) || r.id,
          daysOpen,
          color: DOMAIN_COLORS[domain] || '#888',
        });
      }
    } catch { /* skip */ }
  }

  loops.sort((a, b) => b.daysOpen - a.daysOpen);
  const top = loops.slice(0, 5);
  if (top.length === 0) return '';

  return `<div class="open-loops" id="open-loops">
    <div class="open-loops-header">
      <span class="open-loops-title">open loops</span>
      <span class="open-loops-count">${top.length}</span>
      <span class="open-loops-chevron">${icon('chevron-down', { size: 12 })}</span>
    </div>
    <div class="open-loops-body">
      ${top.map(l => `
        <div class="open-loop-item" data-store="${l.store}" data-id="${l.id}">
          <span class="open-loop-dot" style="background:${l.color}"></span>
          <span class="open-loop-title">${esc(l.title)}</span>
          <span class="open-loop-age">${l.daysOpen}d</span>
        </div>
      `).join('')}
    </div>
  </div>`;
}

export function bindOpenLoops(root) {
  const panel = root.querySelector('#open-loops');
  if (!panel) return;
  panel.querySelector('.open-loops-header')?.addEventListener('click', () => {
    panel.classList.toggle('is-collapsed');
  });
  panel.querySelectorAll('.open-loop-item').forEach(item => {
    item.addEventListener('click', async () => {
      const { openDrawer } = await import('./drawer.js');
      openDrawer(item.dataset.store, item.dataset.id);
    });
  });
}
