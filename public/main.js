// MIRACLE app entry. Three-stage boot:
//   1. No identity  → full-screen login (no app shell)
//   2. Unwelcomed   → onboarding stage (still no shell)
//   3. Welcomed     → bootApp() — mounts topbar/sidebar/router/effects
//
// New routes need an entry in ROUTES below. New entry defaults go in QUICK_NEW.

import { initRouter, registerRoute, navigate, resolve } from './router.js';
import { openStore, put, ulid }                          from './store.js';
import { isAuthed }                                      from './auth.js';
import { loadUser, saveUser }                            from './user.js';
import { mountTopbar }                                   from './topbar.js';
import { mountPalette }                                  from './palette.js';
import { mountMiracle }                                  from './miracle.js';
import { mountDrawer, openDrawer }                       from './drawer.js';
import { mountSidebar }                                  from './sidebar.js';
import { mountBottomNav }                                from './bottom-nav.js';
import { loadHandle }                                    from './bridge.js';
import { snapshotFTI }                                   from './fti.js';
import { buildIndex }                                    from './search.js';
import { checkStreakWarnings }                           from './rewards.js';
import {
  applyTimeOfDay, initFocusMode, initScrollNav,
  initOfflineIndicator, initRipple,
} from './ambient.js';
import { initSwipeNav }                                  from './swipe-nav.js';
import { initPullRefresh }                               from './pull-refresh.js';
import { autoCountUpInView }                             from './count-up.js';
import { initBitmojiPopup }                              from './bitmoji-popup.js';
import { initNotificationWatchers }                      from './notifications.js';
import { initInstallPrompt }                             from './install-prompt.js';
import { initUpdatePrompt }                              from './update.js';
import { initWelcomeTour }                               from './tour.js';
import { loadAndApplyPrefs }                             from './pages/settings.js';
import { renderWelcome }                                 from './pages/welcome.js';

// Page renderers — one import per route, kept eager so first paint of any page
// has no network round-trip. Pages are small; consider lazy if/when this grows.
import { render as renderDaily }      from './pages/daily.js';
import { render as renderIdeas }      from './pages/ideas.js';
import { render as renderTasks }      from './pages/tasks.js';
import { render as renderProjects }   from './pages/projects.js';
import { render as renderPlans }      from './pages/plans.js';
import { render as renderSchedule }   from './pages/schedule.js';
import { render as renderFinance }    from './pages/finance.js';
import { render as renderPrayer }     from './pages/prayer.js';
import { render as renderFasting }    from './pages/fasting.js';
import { render as renderBible }      from './pages/bible.js';
import { render as renderDreams }     from './pages/dreams.js';
import { render as renderMeals }      from './pages/meals.js';
import { render as renderBooks }      from './pages/books.js';
import { render as renderQuizzes }    from './pages/quizzes.js';
import { render as renderBlog }       from './pages/blog.js';
import { render as renderBlogEdit }   from './pages/blog-edit.js';
import { render as renderDashboard }  from './pages/dashboard.js';
import { render as renderSearch }     from './pages/search.js';
import { render as renderSettings }   from './pages/settings.js';
import { render as renderTestimony }  from './pages/testimony.js';
import { render as renderMusic }      from './pages/music.js';
import { render as renderPeople }     from './pages/people.js';
import { render as renderBook }       from './pages/book.js';
import { render as renderBitmoji }    from './pages/bitmoji.js';
import { render as renderLogin }      from './pages/login.js';
import { render as renderVerified }   from './pages/verified.js';
import { render as renderReset }      from './pages/reset.js';
import { render as renderProphecies } from './pages/prophecies.js';
import { render as renderFocus }      from './pages/focus.js';
import { render as renderTrash }      from './pages/trash.js';

import { R } from './util/routes.js';
import { S } from './util/stores.js';

// ─── Timing constants ─────────────────────────────────────────────
const ONE_MINUTE = 60_000;
const FIVE_MINUTES = 5 * ONE_MINUTE;

// ─── Route table ──────────────────────────────────────────────────
// Each entry: [pathRegex, renderFn]. registerRoute matches in order.
const ROUTES = [
  [/^\/day$/,                              () => renderDaily([today()])],
  [/^\/day\/(\d{4}-\d{2}-\d{2})$/,         renderDaily],
  [/^\/ideas$/,                             renderIdeas],
  [/^\/tasks$/,                             renderTasks],
  [/^\/projects$/,                          renderProjects],
  [/^\/plans$/,                             renderPlans],
  [/^\/schedule$/,                          renderSchedule],
  [/^\/finance$/,                           renderFinance],
  [/^\/prayer$/,                            renderPrayer],
  [/^\/fasting$/,                           renderFasting],
  [/^\/bible$/,                             renderBible],
  [/^\/dreams$/,                            renderDreams],
  [/^\/meals$/,                             renderMeals],
  [/^\/books$/,                             renderBooks],
  [/^\/quizzes$/,                           renderQuizzes],
  [/^\/blog$/,                              renderBlog],
  [/^\/blog\/([A-Z0-9]+)$/,                 renderBlogEdit],
  [/^\/dashboard$/,                         renderDashboard],
  [/^\/search(?:\?.*)?$/,                   renderSearch],
  [/^\/settings$/,                          renderSettings],
  [/^\/testimony$/,                         renderTestimony],
  [/^\/music$/,                             renderMusic],
  [/^\/people$/,                            renderPeople],
  [/^\/book$/,                              renderBook],
  [/^\/bitmoji$/,                           renderBitmoji],
  [/^\/login$/,                             renderLogin],
  [/^\/auth\/verified(?:\?.*)?$/,           renderVerified],
  [/^\/auth\/reset\/([a-f0-9]{64})$/,       renderReset],
  [/^\/prophecies$/,                        renderProphecies],
  [/^\/focus$/,                             renderFocus],
  [/^\/trash$/,                             renderTrash],
];

// ─── "+ new" defaults per route ───────────────────────────────────
const QUICK_NEW = {
  [R.dreams]:    { store: S.dreams,       defaults: () => ({ type: 'nightDream', dreamDate: today(), status: 'active', weight: 50, title: '' }) },
  [R.ideas]:     { store: S.ideas,        defaults: () => ({ status: 'active', weight: 50, title: '', body: '', tags: [] }) },
  [R.bible]:     { store: S.bible,        defaults: () => ({ translation: 'NIV', status: 'active', passage: '' }) },
  [R.prayer]:    { store: S.prayers,      defaults: () => ({ type: 'supplication', intensity: 3, startedOn: today(), answer: 'pending', cadence: 'one-off', status: 'active', subject: '' }) },
  [R.fasting]:   { store: S.fasts,        defaults: () => ({ type: 'water', startedAt: nowIso(), status: 'active', purpose: '' }) },
  [R.plans]:     { store: S.plans,        defaults: () => ({ phase: 'concept', status: 'active', weight: 50, venture: 'Personal', milestones: [], kpis: [], title: '', thesis: '' }) },
  [R.projects]:  { store: S.projects,     defaults: () => ({ phase: 'brief', status: 'active', title: '' }) },
  [R.tasks]:     { store: S.tasks,        defaults: () => ({ priority: 'P2', scheduledFor: today(), context: 'shallow', status: 'active', title: '' }) },
  [R.schedule]:  { store: S.events,       defaults: () => ({ type: 'meeting', startAt: nextHour(0), endAt: nextHour(1), title: '' }) },
  [R.meals]:     { store: S.meals,        defaults: () => ({ date: today(), slot: inferSlot(), source: 'home', homeCooked: 'yes', actualItems: [] }) },
  [R.finance]:   { store: S.transactions, defaults: () => ({ date: today(), direction: 'out', amountGhs: 0, account: 'MoMo', venture: 'Personal', category: 'misc', tithe: 'no', payee: '' }) },
  [R.books]:     { store: S.books,        defaults: () => ({ format: 'book', status: 'reading', startedOn: today(), title: '', author: '' }) },
  [R.quizzes]:   { store: S.quizzes,      defaults: () => ({ type: 'short', status: 'due', level: 0, nextDueAt: nowIso(), question: '', answer: '' }) },
  [R.testimony]: { store: S.testimonies,  defaults: () => ({ date: today(), status: 'active', title: '', body: '' }) },
  [R.music]:     { store: S.music,        defaults: () => ({ date: today(), title: '', artist: '' }) },
  [R.people]:    { store: S.people,       defaults: () => ({ lastTouchedAt: today(), pray: 'no', name: '' }) },
  [R.blog]:      { store: S.blogs,        defaults: () => ({ status: 'seeding', variants: [], seedSource: 'manual', seedCapturedAt: nowIso(), seedText: '', title: '', topics: '' }), navigate: id => R.blogId(id) },
};

// ─── Date/time helpers ────────────────────────────────────────────
function today()         { return new Date().toISOString().slice(0, 10); }
function nowIso()        { return new Date().toISOString(); }
function nextHour(off)   { const d = new Date(); d.setMinutes(0,0,0); d.setHours(d.getHours() + 1 + off); return d.toISOString(); }
function inferSlot()     {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 13) return 'lunch';
  if (h < 16) return 'teatime';
  if (h < 21) return 'dinner';
  return 'latenight';
}

function mountQuickNew(path) {
  document.querySelectorAll('.new-btn').forEach(b => b.remove());
  const spec = QUICK_NEW[path];
  if (!spec) return;
  const head = document.querySelector('#canvas .page-head');
  if (!head) return;
  const btn = document.createElement('button');
  btn.className = 'btn is-primary new-btn';
  btn.textContent = '+ new';
  btn.addEventListener('click', async () => {
    const draftStamp = nowIso();
    const entry = {
      id: ulid(),
      ...spec.defaults(),
      ...(spec.navigate ? {} : { _draft: true, _draftCreatedAt: draftStamp }),
    };
    await put(spec.store, entry);
    if (spec.navigate) location.hash = spec.navigate(entry.id);
    else                openDrawer(spec.store, entry.id);
  });
  head.appendChild(btn);
}

// ─── App boot (post-gate) ─────────────────────────────────────────
async function bootApp() {
  mountTopbar(document.getElementById('topbar'));
  mountPalette(document.getElementById('palette'));
  mountMiracle(document.getElementById('miracle'));
  mountDrawer(document.getElementById('drawer'));
  initRouter(document.getElementById('canvas'));

  for (const [pattern, render] of ROUTES) registerRoute(pattern, render);

  await loadHandle();

  // Safari (and some older browsers) don't define requestIdleCallback at all —
  // referencing the bare identifier throws ReferenceError even with optional
  // chaining. Go through window so the property access is safe.
  const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1));
  idle(() => { snapshotFTI().catch(() => {}); buildIndex().catch(() => {}); });

  // Ambient + chrome
  applyTimeOfDay();
  setInterval(applyTimeOfDay, ONE_MINUTE);
  initFocusMode();
  mountSidebar();
  mountBottomNav();
  initScrollNav();
  initSwipeNav();
  initPullRefresh();
  initRipple();
  initOfflineIndicator();
  initBitmojiPopup();
  initNotificationWatchers();
  initWelcomeTour();

  checkStreakWarnings();
  setInterval(checkStreakWarnings, FIVE_MINUTES);

  window.addEventListener('route:change', e => {
    setTimeout(() => mountQuickNew(e.detail.path), 0);
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const domain = e.detail.path.match(/^\/(\w+)/)?.[1] || '';
    if (domain) canvas.setAttribute('data-domain', domain);
    else        canvas.removeAttribute('data-domain');
    setTimeout(() => autoCountUpInView(canvas), 100);
  });

  if (!location.hash) navigate(R.dashboard);
  else                resolve();
}

// ─── Three-stage gate ─────────────────────────────────────────────
async function boot() {
  await openStore();
  await loadAndApplyPrefs();

  const user = await loadUser();
  const hasIdentity = isAuthed() || !!(user && user.name);
  const welcomed    = !!(user && user.welcomed);

  if (!hasIdentity) return showLoginGate();
  if (!welcomed)    return showWelcome();
  await bootApp();
}

async function showLoginGate() {
  document.body.classList.add('login-gate-mode');
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '';
  canvas.appendChild(await renderLogin());
}

async function showWelcome() {
  const stage = await renderWelcome(async () => {
    await saveUser({ welcomed: true });
    document.body.classList.remove('welcome-mode');
    document.getElementById('canvas').innerHTML = '';
    window.dispatchEvent(new CustomEvent('user:changed'));
    await bootApp();
  });
  document.body.classList.add('welcome-mode');
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = '';
  canvas.appendChild(stage);
}

// ─── Service worker + update banner ───────────────────────────────
// Force-reloading on controllerchange nukes in-progress form input — surface a
// non-destructive banner instead. Auto-reload only if the tab is hidden
// (the user isn't typing).
// Service-worker/version checks are centralized in update.js.

function showUpdateBanner() {
  if (document.querySelector('.update-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.innerHTML = `
    <span class="update-banner-text">new version available</span>
    <button class="btn is-primary update-banner-reload" type="button">reload</button>
    <button class="update-banner-dismiss" type="button" aria-label="dismiss later">×</button>
  `;
  document.body.appendChild(banner);
  banner.querySelector('.update-banner-reload').addEventListener('click', () => location.reload());
  banner.querySelector('.update-banner-dismiss').addEventListener('click', () => banner.remove());
}

// ─── Install prompt orchestration (extracted) ─────────────────────
initInstallPrompt();
initUpdatePrompt();

// ─── Boot with safe error rendering ───────────────────────────────
boot().catch(err => {
  console.error('boot failed', err);
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  // Build the error page with DOM APIs so err.message (which could include user
  // input or attacker-controlled strings) can never become HTML.
  const page = document.createElement('div');
  page.className = 'page';
  const h1 = document.createElement('h1');
  h1.className = 'page-title';
  h1.textContent = 'could not start';
  const pre = document.createElement('pre');
  pre.style.cssText = 'color:var(--ruby);font-size:11px;white-space:pre-wrap;';
  pre.textContent = err?.message || String(err);
  page.append(h1, pre);
  canvas.replaceChildren(page);
});
