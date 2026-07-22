// Welcome / onboarding gate. Runs on first launch (no user profile saved).
// Sets name · calling · theme · mode, then bootstraps into the app.

import { saveUser } from '../user.js';
import { randomVerse } from '../scripture.js';
import { applyPrefs } from './settings.js';
import { put } from '../store.js';
import { icon } from '../icons.js';

import { esc } from '../util/esc.js';
const THEMES = [
  { id: 'eden-night',  label: 'eden night',  swatch: ['#050608', '#0C0E11', '#10B981', '#34D399'], blurb: 'garden dark · emerald' },
  { id: 'manna-paper', label: 'manna paper', swatch: ['#F6F1E5', '#EFE8D6', '#047857', '#BE123C'], blurb: 'ivory · morning bread' },
  { id: 'zion-watch',  label: 'zion watch',  swatch: ['#0D1117', '#161B22', '#3FB950', '#F85149'], blurb: 'midnight watch' },
  { id: 'selah-mocha', label: 'selah mocha', swatch: ['#1E1E2E', '#181825', '#A6E3A1', '#F38BA8'], blurb: 'warm pause' },
];
const MODES = [
  { id: 'minimalist', title: 'minimalist', blurb: 'tight · for the adhd brain' },
  { id: 'regular',    title: 'regular',    blurb: 'breathable · standard' },
  { id: 'extreme',    title: 'extreme',    blurb: 'maximal · everything visible' },
];

const CALLING_PRESETS = [
  'build software that serves Ghana',
  'raise a household rooted in Christ',
  'steward the work and the people around me',
  'see the kingdom advance through business',
];

const STEPS = ['name', 'calling', 'theme', 'mode', 'blessing'];

export async function renderWelcome(onComplete) {
  let step = 0;
  const draft = { name: '', calling: '', theme: 'eden-night', mode: 'minimalist' };
  const verse = randomVerse();

  const stage = document.createElement('div');
  stage.className = 'welcome-stage';

  const paint = () => {
    applyPrefs({ theme: draft.theme, mode: draft.mode, tweaks: { animations: 'on' } });
    stage.innerHTML = `
      <div class="welcome-card">
        <div class="welcome-mark">
          <span class="word">MIRACLE</span>
          <span class="dot emerald pulse"></span>
          <span class="welcome-version">nes · v0 · holy spirit ≠ a.i.</span>
        </div>

        <div class="welcome-greeting">
          ${stepIcon(step)}
          <span>${stepTitle(step, draft)}</span>
        </div>

        <div class="welcome-step">${renderStep(step, draft)}</div>

        <div class="welcome-progress">
          ${STEPS.map((_, i) => `<span class="${i < step ? 'is-done' : i === step ? 'is-active' : ''}"></span>`).join('')}
        </div>

        <div class="welcome-actions">
          ${step > 0 ? `<button class="btn" data-act="back">${icon('arrow-left', { size: 12 })} back</button>` : ''}
          <button class="btn is-primary" data-act="next" ${canAdvance(step, draft) ? '' : 'disabled'}>
            ${step === STEPS.length - 1 ? 'enter' : 'continue'} ${icon('arrow-right', { size: 12 })}
          </button>
        </div>

        <div class="welcome-scripture">"${esc(verse.text)}" — ${esc(verse.ref)}</div>
      </div>
    `;
    wire();
  };

  const wire = () => {
    stage.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('input', e => {
        draft[input.dataset.field] = e.target.value;
        // refresh disabled state of next button without full repaint
        const nextBtn = stage.querySelector('[data-act="next"]');
        if (nextBtn) nextBtn.toggleAttribute('disabled', !canAdvance(step, draft));
      });
      if (step === 0 || step === 1) setTimeout(() => input.focus(), 30);
    });
    stage.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', () => {
      draft.calling = b.dataset.preset;
      paint();
    }));
    stage.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => {
      draft.theme = b.dataset.theme;
      paint();
    }));
    stage.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      draft.mode = b.dataset.mode;
      paint();
    }));
    stage.querySelector('[data-act="back"]')?.addEventListener('click', () => {
      step = Math.max(0, step - 1);
      paint();
    });
    stage.querySelector('[data-act="next"]')?.addEventListener('click', async () => {
      if (!canAdvance(step, draft)) return;
      if (step < STEPS.length - 1) { step++; paint(); return; }
      // finish
      await saveUser({ name: draft.name.trim(), calling: draft.calling.trim() });
      await put('meta', { key: 'prefs', value: { theme: draft.theme, mode: draft.mode, tweaks: { animations: 'on' } } });
      // Welcome sparkle shower — one-time celebration
      try {
        const { awardAchievement } = await import('../rewards.js');
        awardAchievement('seat_ready');
        const { sparkleShower } = await import('../ambient.js');
        sparkleShower();
        setTimeout(() => sparkleShower(), 900);
        setTimeout(() => sparkleShower(), 1800);
      } catch { /* ignore */ }
      onComplete();
    });
  };

  paint();
  return stage;
}
function stepIcon(step) {
  const i = ['user', 'compass', 'moon', 'target', 'sparkles'][step];
  return `<span class="welcome-step-icon">${icon(i, { size: 14 })}</span>`;
}

function stepTitle(step, draft) {
  if (step === 0) return "let's set up your seat. five small steps.";
  if (step === 1) return 'your calling, in one line';
  if (step === 2) return 'pick a covering';
  if (step === 3) return 'choose a pace';
  if (step === 4) return 'consecrate';
}

function canAdvance(step, draft) {
  if (step === 0) return draft.name.trim().length > 0;
  if (step === 1) return draft.calling.trim().length > 0;
  return true;
}

function renderStep(step, draft) {
  if (step === 0) return `
    <input type="text" data-field="name" autofocus placeholder="first name · or what your wife/people call you" value="${esc(draft.name)}" style="font-size:15px">
    <div class="welcome-meta">nes will address you by name. lowercase, like a friend.</div>
  `;
  if (step === 1) return `
    <input type="text" data-field="calling" placeholder="e.g. build software that serves Ghana" value="${esc(draft.calling)}" style="font-size:13px">
    <div class="welcome-chips">
      ${CALLING_PRESETS.map(p => `<button class="chip" data-preset="${esc(p)}">${esc(p)}</button>`).join('')}
    </div>
    <div class="welcome-meta">nes echoes this back when you drift. keep it short.</div>
  `;
  if (step === 2) return `
    <div class="theme-grid welcome-grid">
      ${THEMES.map(t => `
        <button class="theme-tile ${draft.theme === t.id ? 'is-active' : ''}" data-theme="${t.id}">
          <div class="theme-swatch">${t.swatch.map(c => `<div style="background:${c}"></div>`).join('')}</div>
          <div class="theme-label">${t.label}</div>
          <div class="welcome-meta">${t.blurb}</div>
        </button>
      `).join('')}
    </div>
  `;
  if (step === 3) return `
    <div class="mode-row">
      ${MODES.map(m => `
        <button class="mode-tile ${draft.mode === m.id ? 'is-active' : ''}" data-mode="${m.id}">
          <div class="mode-id">${m.title}</div>
          <div class="meta">${m.blurb}</div>
        </button>
      `).join('')}
    </div>
  `;
  if (step === 4) return `
    <div class="welcome-blessing">
      <div class="welcome-seat">seat ready for <strong class="emerald">${esc(draft.name.toLowerCase())}</strong>.</div>
      <div class="welcome-calling">"${esc(draft.calling)}"</div>
      <div class="welcome-meta">a reminder: nes is a tool. the Holy Spirit is never an A.I. when you feel something move in you, trust him — not us.</div>
    </div>
  `;
}
