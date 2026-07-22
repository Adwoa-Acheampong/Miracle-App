// bitmoji-popup.js - randomly stages Moji in the app chrome.

import { get } from './store.js';
import { renderBitmoji } from './pages/bitmoji.js';
import { verseForDate } from './scripture.js';
import { esc } from './util/esc.js';

const ACTIONS = [
  { text: 'waves you back into focus',      anim: 'wave',  action: 'wave',   expression: 'joyful' },
  { text: 'sips tea slowly',                anim: 'sip',   action: 'sip',    expression: 'steady' },
  { text: 'opens scripture',                anim: 'idle',  action: 'read',   expression: 'focused' },
  { text: 'kneels in prayer',               anim: 'pray',  action: 'pray',   expression: 'prayer' },
  { text: 'closes a task with you',         anim: 'pump',  action: 'wave',   expression: 'joyful' },
  { text: 'reads the room before you rush', anim: 'think', action: 'idle',   expression: 'focused' },
  { text: 'dances - holy joy',              anim: 'dance', action: 'wave',   expression: 'joyful' },
  { text: 'breathes slowly',                anim: 'sleep', action: 'idle',   expression: 'steady' },
  { text: 'journals beside you',            anim: 'idle',  action: 'read',   expression: 'focused' },
  { text: 'walks with a word',              anim: 'walk',  action: 'banner', expression: 'joyful', banner: true },
];

const BANNER_WORDS = [
  'steady is still progress',
  'one faithful line counts',
  'small obedience, clean momentum',
  'return gently. start again.',
];

let timer = null;

export async function initBitmojiPopup() {
  if (timer) clearInterval(timer);
  scheduleNext();
}

async function scheduleNext() {
  const cfg = (await get('meta', 'bitmoji'))?.value;
  if (!cfg || cfg.popups !== 'on') {
    timer = setTimeout(scheduleNext, 60000);
    return;
  }
  const delay = (3 + Math.random() * 5) * 60000;
  timer = setTimeout(() => {
    showPopup(cfg);
    scheduleNext();
  }, delay);
}

function showPopup(cfg) {
  if (document.querySelector('.bm-popup, .bm-popup-walk')) return;
  const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  if (action.banner) {
    showWalkingBanner(cfg, action);
    return;
  }

  const corner = ['tl', 'tr', 'bl', 'br'][Math.floor(Math.random() * 4)];
  const pop = document.createElement('div');
  pop.className = `bm-popup corner-${corner}`;
  const mojiAction = action.action || action.anim || 'idle';
  const mojiCfg = { ...cfg, expression: action.expression || cfg.expression };
  pop.innerHTML = `
    <div class="bm-popup-avatar bm-anim-${action.anim}">
      <div class="moji-svg-fallback" aria-hidden="true">${renderBitmoji(mojiCfg, { action: mojiAction })}</div>
    </div>
    <div class="bm-popup-bubble">${esc(action.text)}</div>
  `;
  document.body.appendChild(pop);

  setTimeout(() => {
    pop.classList.add('is-leaving');
    setTimeout(() => pop.remove(), 600);
  }, 10000);

  pop.addEventListener('click', () => {
    pop.classList.add('is-leaving');
    setTimeout(() => pop.remove(), 600);
  });
}

function showWalkingBanner(cfg, action) {
  const today = new Date().toISOString().slice(0, 10);
  const verse = verseForDate(today);
  const line = Math.random() > 0.42
    ? `"${verse.text}" - ${verse.ref}`
    : BANNER_WORDS[Math.floor(Math.random() * BANNER_WORDS.length)];

  const pop = document.createElement('div');
  pop.className = 'bm-popup-walk';
  const mojiCfg = { ...cfg, expression: action.expression || cfg.expression };
  pop.innerHTML = `
    <div class="bm-walk-avatar bm-anim-${action.anim}">
      <div class="moji-svg-fallback" aria-hidden="true">${renderBitmoji(mojiCfg, { action: 'banner' })}</div>
    </div>
    <div class="bm-walk-banner"><span>${esc(line)}</span></div>
  `;
  document.body.appendChild(pop);
  setTimeout(() => pop.classList.add('is-leaving'), 13200);
  setTimeout(() => pop.remove(), 14000);
  pop.addEventListener('click', () => {
    pop.classList.add('is-leaving');
    setTimeout(() => pop.remove(), 500);
  });
}
