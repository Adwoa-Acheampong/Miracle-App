import { all } from '../store.js';
import { computeFTI } from '../fti.js';
import { navigate } from '../router.js';
import { icon } from '../icons.js';
import { verseForDate } from '../scripture.js';
import { loadUser, firstName } from '../user.js';
import { renderMomentumBar, renderOpenLoops, bindOpenLoops, renderMiracleGame, bindMiracleGame } from '../rewards.js';
import { logMood, renderMoodStrip } from '../mood.js';
import { renderEncouragementCard } from '../encouragement.js';
import { esc } from '../util/esc.js';
import { APP_LANES, getAllStoreNames, resolveRoute } from '../app-map.js';

const STORE_NAMES = getAllStoreNames();

export async function render() {
  const today = new Date().toISOString().slice(0, 10);
  const user = await loadUser();
  const name = firstName(user);
  const verse = verseForDate(today);

  const collections = await loadCollections(STORE_NAMES);
  const fti = await computeFTI();
  const metrics = buildMetrics(collections, today, fti);

  const [momentumHtml, openLoopsHtml, moodStripHtml, encouragementHtml] = await Promise.all([
    renderMomentumBar().catch(() => ''),
    renderOpenLoops().catch(() => ''),
    renderMoodStrip().catch(() => ''),
    renderEncouragementCard().catch(() => ''),
  ]);

  const root = document.createElement('div');
  root.className = 'page page-wide life-home';
  root.innerHTML = `
    ${renderHero({ today, name, verse, metrics })}
    ${renderStartFlow({ today, metrics })}
    ${moodStripHtml}
    ${renderLifeGauges(metrics)}
    ${renderFeatureLanes(collections, today)}
    ${renderRewardStack({ gameHtml: renderMiracleGame({ momentumHtml }), openLoopsHtml, encouragementHtml })}
  `;

  bindDashboard(root);
  return root;
}

async function loadCollections(stores) {
  const entries = await Promise.all(stores.map(async store => {
    const rows = await all(store).catch(() => []);
    return [store, rows];
  }));
  return Object.fromEntries(entries);
}

function buildMetrics(data, today, fti) {
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekStartIso = weekStart.toISOString().slice(0, 10);

  const daily = data.daily || [];
  const tasks = data.tasks || [];
  const prayers = data.prayers || [];
  const transactions = data.transactions || [];
  const books = data.books || [];
  const projects = data.projects || [];
  const ideas = data.ideas || [];
  const focusSessions = data.focusSessions || [];

  const focusToday = focusSessions.filter(session => (session.startedAt || '').startsWith(today));
  const focusMinToday = Math.round(focusToday.reduce((sum, session) => sum + (session.elapsedSecs || 0), 0) / 60);
  const openTasks = tasks.filter(task => !task.completedAt).length;
  const closedThisWeek = tasks.filter(task => (task.completedAt || '') >= weekStartIso).length;
  const activePrayer = prayers.filter(prayer => !prayer.answer || prayer.answer === 'pending').length;
  const dailyToday = daily.find(entry => entry.date === today && (entry.oneSentence || entry.freeform));
  const dailyFilled = daily.filter(entry => entry.oneSentence || entry.freeform).length;
  const activeProjects = projects.filter(project => project.status !== 'done' && project.status !== 'archived').length;
  const activeIdeas = ideas.filter(idea => idea.status !== 'archived').length;
  const booksReading = books.filter(book => book.status === 'reading').length;

  const income = transactions
    .filter(tx => tx.direction === 'in')
    .reduce((sum, tx) => sum + Number(tx.amountGhs || 0), 0);
  const tithed = transactions
    .filter(tx => tx.tithe === 'yes')
    .reduce((sum, tx) => sum + Number(tx.amountGhs || 0), 0);
  const titheRate = income > 0 ? Math.round((tithed / income) * 100) : 0;

  return {
    ftiScore: fti.score || 0,
    totalTasks: tasks.length,
    dailyToday: !!dailyToday,
    dailyFilled,
    focusMinToday,
    focusSessionCount: focusToday.length,
    openTasks,
    closedThisWeek,
    activePrayer,
    titheRate,
    booksReading,
    activeProjects,
    activeIdeas,
  };
}

function renderHero({ today, name, verse, metrics }) {
  return `
    <section class="life-hero rebuilt-hero">
      <div class="life-hero-copy">
        <div class="life-kicker">Miracle worker</div>
        <h1>${esc(greeting())}, ${esc(name)}</h1>
        <p class="life-date">${esc(formatDate(today))}</p>
        <blockquote class="life-verse classic-italic">
          <span>"${esc(verse.text)}"</span>
          <cite>${esc(verse.ref)}</cite>
        </blockquote>
      </div>
      <button class="life-hero-ring route-card" type="button" data-route="/tasks" aria-label="Open follow-through">
        <span class="num">${esc(String(metrics.ftiScore))}</span>
        <small>follow-through</small>
      </button>
    </section>
  `;
}

function renderStartFlow({ today, metrics }) {
  const cards = [
    {
      label: 'Today page',
      hint: metrics.dailyToday ? 'logged' : 'write one line',
      route: `/day/${today}`,
      iconName: 'calendar',
      value: metrics.dailyToday ? 'done' : 'start',
    },
    {
      label: 'Focus',
      hint: `${metrics.focusSessionCount} sessions today`,
      route: '/focus',
      iconName: 'target',
      value: `${metrics.focusMinToday}m`,
    },
    {
      label: 'Tasks',
      hint: `${metrics.closedThisWeek} closed this week`,
      route: '/tasks',
      iconName: 'list-checks',
      value: metrics.openTasks,
    },
    {
      label: 'Prayer',
      hint: 'stand on what matters',
      route: '/prayer',
      iconName: 'flame',
      value: metrics.activePrayer,
    },
  ];

  return `
    <section class="start-panel">
      <div class="section-head">
        <span>Start here</span>
        <small>one tap, one lane</small>
      </div>
      <div class="start-grid">
        ${cards.map(card => `
          <button class="route-card start-card" type="button" data-route="${esc(card.route)}">
            <span class="card-icon">${icon(card.iconName, { size: 18 })}</span>
            <span class="card-copy">
              <strong>${esc(card.label)}</strong>
              <small>${esc(card.hint)}</small>
            </span>
            <span class="card-value">${esc(String(card.value))}</span>
          </button>
        `).join('')}
      </div>
    </section>
  `;
}

function renderLifeGauges(metrics) {
  const gauges = [
    { label: 'Today', route: '/day', iconName: 'calendar', value: metrics.dailyToday ? 'logged' : 'empty', score: metrics.dailyToday ? 86 : 0, hint: 'presence' },
    { label: 'Focus', route: '/focus', iconName: 'target', value: `${metrics.focusMinToday}m`, score: meterPct(metrics.focusMinToday, 90), hint: '90m goal' },
    { label: 'Tasks', route: '/tasks', iconName: 'list-checks', value: metrics.openTasks, score: metrics.totalTasks ? meterPct(12 - Math.min(metrics.openTasks, 12), 12) : 0, hint: 'less open' },
    { label: 'Giving', route: '/finance', iconName: 'wallet', value: `${metrics.titheRate}%`, score: meterPct(metrics.titheRate, 10), hint: 'stewardship' },
    { label: 'Build', route: '/projects', iconName: 'target', value: metrics.activeProjects, score: meterPct(metrics.activeProjects, 6), hint: 'active work' },
    { label: 'Ideas', route: '/ideas', iconName: 'lightbulb', value: metrics.activeIdeas, score: meterPct(metrics.activeIdeas, 10), hint: 'sparks' },
  ];

  return `
    <section class="life-meters-section">
      <div class="section-head">
        <span>Life gauges</span>
        <small>quick read</small>
      </div>
      <div class="life-meters">
        ${gauges.map(gauge => `
          <button class="route-card life-meter" type="button" data-route="${esc(gauge.route)}" style="--meter:${gauge.score}%">
            <span class="meter-top">
              <span>${icon(gauge.iconName, { size: 15 })}${esc(gauge.label)}</span>
              <strong>${esc(String(gauge.value))}</strong>
            </span>
            <span class="meter-track"><i></i></span>
            <small>${esc(gauge.hint)}</small>
          </button>
        `).join('')}
      </div>
    </section>
  `;
}

function renderFeatureLanes(collections, today) {
  return `
    <section class="life-lanes-section">
      <div class="section-head">
        <span>Full app</span>
        <small>also in the menu</small>
      </div>
      <div class="life-lanes">
        ${APP_LANES.map(lane => `
          <article class="life-lane-card">
            <header class="lane-head">
              <span class="lane-icon">${icon(lane.iconName, { size: 18 })}</span>
              <span>
                <strong>${esc(lane.title)}</strong>
                <small>${esc(lane.promise)}</small>
              </span>
            </header>
            <div class="lane-items">
              ${lane.items.map(item => {
                const route = resolveRoute(item, today);
                const count = item.store ? (collections[item.store] || []).length : '';
                return `
                  <button class="lane-chip route-card" type="button" data-route="${esc(route)}">
                    <span>${icon(item.iconName, { size: 14 })}${esc(item.label)}</span>
                    <small>${esc(item.verb)}</small>
                    <b>${esc(String(count))}</b>
                  </button>
                `;
              }).join('')}
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderRewardStack({ gameHtml, openLoopsHtml, encouragementHtml }) {
  const supportBlocks = [openLoopsHtml, encouragementHtml].filter(Boolean);
  const blocks = [gameHtml, ...supportBlocks].filter(Boolean);
  if (!blocks.length) return '';
  return `
    <section class="life-reward-stack miracle-reward-world">
      <div class="section-head">
        <span>Miracle Journey</span>
        <small>play your progress</small>
      </div>
      <div class="life-reward-grid">
        ${gameHtml || ''}
        ${supportBlocks.length ? `<div class="mj-support-grid">${supportBlocks.join('')}</div>` : ''}
      </div>
    </section>
  `;
}

function bindDashboard(root) {
  root.querySelectorAll('[data-route]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.route));
  });

  root.querySelectorAll('[data-mood-quick]').forEach(btn => {
    btn.addEventListener('click', async event => {
      event.stopPropagation();
      btn.classList.add('is-saving');
      await logMood(btn.dataset.moodQuick);
      const fresh = await render();
      root.replaceWith(fresh);
    });
  });

  root.querySelectorAll('.enc-card').forEach(card => {
    card.addEventListener('click', async () => {
      const { openDrawer } = await import('../drawer.js');
      openDrawer(card.dataset.store, card.dataset.id);
    });
  });

  bindOpenLoops(root);
  bindMiracleGame(root);
}

function meterPct(value, target) {
  if (!Number.isFinite(value) || !Number.isFinite(target) || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'good morning';
  if (h < 18) return 'still up';
  return 'good evening';
}

function formatDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
