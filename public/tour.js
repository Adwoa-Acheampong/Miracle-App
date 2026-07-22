// tour.js - first-run guided tour for hidden Miracle affordances.

const TOUR_KEY = 'miracle_welcome_tour_v1';

const STEPS = [
  {
    selector: '#topbar',
    title: 'Command bar',
    body: 'This top strip holds the hamburger menu, search, Nes, vault, settings, and profile. When it glows, there is something worth tapping.',
  },
  {
    selector: '#tb-menu',
    title: 'Full app menu',
    body: 'Tap here when you feel lost. Every lane lives in the menu, including the animated book, faith tools, build tools, and recovery.',
  },
  {
    selector: '#tb-miracle',
    title: 'Nes',
    body: 'The pulsing sparkle opens Nes. You can type commands, ask for help, capture tasks, prayers, ideas, scripture notes, and more.',
  },
  {
    selector: '.start-panel',
    title: 'Start here',
    body: 'This is the simplest drill: one line, one focus session, one task, or one prayer. Pick one lane and move.',
  },
  {
    selector: '.life-lanes-section > .section-head',
    title: 'Hidden gems',
    body: 'This header opens the broader system beneath it. The animated book, Bible, projects, finance, meals, books, music, and people all sit below.',
  },
  {
    selector: '.life-reward-stack',
    title: 'Miracle Sparkles',
    body: 'Your reward loop lives here. Sparks unlock when you return, pray, read, build, and keep rhythm. The glow is there so you do not miss it.',
  },
];

let active = false;

export function initWelcomeTour() {
  window.startMiracleTour = () => showTour({ force: true });
  window.addEventListener('route:change', event => {
    if (event.detail?.path === '/dashboard') {
      setTimeout(() => showTour(), 900);
    }
  });
  if ((location.hash || '#/dashboard') === '#/dashboard') {
    setTimeout(() => showTour(), 1200);
  }
}

function showTour({ force = false } = {}) {
  if (active) return;
  if (!force && localStorage.getItem(TOUR_KEY) === 'done') return;
  if (!document.querySelector('.life-home')) return;
  active = true;
  let index = 0;

  const overlay = document.createElement('div');
  overlay.className = 'miracle-tour';
  overlay.innerHTML = `
    <div class="tour-shade"></div>
    <div class="tour-spotlight"></div>
    <section class="tour-card" role="dialog" aria-modal="true" aria-live="polite">
      <div class="tour-kicker">Miracle tour</div>
      <h2></h2>
      <p></p>
      <div class="tour-count"></div>
      <div class="tour-actions">
        <button class="btn tour-skip" type="button">skip</button>
        <button class="btn tour-next is-primary" type="button">next</button>
      </div>
    </section>
  `;
  document.body.appendChild(overlay);

  const card = overlay.querySelector('.tour-card');
  const spot = overlay.querySelector('.tour-spotlight');
  const title = overlay.querySelector('h2');
  const body = overlay.querySelector('p');
  const count = overlay.querySelector('.tour-count');
  const next = overlay.querySelector('.tour-next');
  const skip = overlay.querySelector('.tour-skip');

  const close = (done = true) => {
    if (done) localStorage.setItem(TOUR_KEY, 'done');
    overlay.classList.add('is-leaving');
    setTimeout(() => overlay.remove(), 220);
    active = false;
  };

  const paint = () => {
    const step = STEPS[index];
    const target = document.querySelector(step.selector);
    if (!target) {
      index += 1;
      if (index >= STEPS.length) return close();
      paint();
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    setTimeout(() => {
      const rect = target.getBoundingClientRect();
      const pad = 8;
      spot.style.left = `${Math.max(8, rect.left - pad)}px`;
      spot.style.top = `${Math.max(8, rect.top - pad)}px`;
      spot.style.width = `${Math.min(window.innerWidth - 16, rect.width + pad * 2)}px`;
      spot.style.height = `${Math.min(window.innerHeight - 16, rect.height + pad * 2)}px`;

      const cardW = Math.min(340, window.innerWidth - 28);
      card.style.width = `${cardW}px`;
      card.style.left = `${Math.max(14, Math.min(window.innerWidth - cardW - 14, rect.left))}px`;
      const below = rect.bottom + 14;
      const above = rect.top - 220;
      card.style.top = `${below + 220 < window.innerHeight ? below : Math.max(14, above)}px`;

      title.textContent = step.title;
      body.textContent = step.body;
      count.textContent = `${index + 1} of ${STEPS.length}`;
      next.textContent = index === STEPS.length - 1 ? 'done' : 'next';
    }, 240);
  };

  next.addEventListener('click', () => {
    index += 1;
    if (index >= STEPS.length) close();
    else paint();
  });
  skip.addEventListener('click', () => close());
  overlay.querySelector('.tour-shade').addEventListener('click', () => close(false));
  window.addEventListener('resize', paint, { once: true });
  paint();
}
