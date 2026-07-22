// mood.js — emoji-based mood logging stored on the daily journal entry.
// One mood per day (today's entry). The 14-day trend reads from `daily` store.

import { get, put, all } from './store.js';

// Mood library — curated emoji set grouped by category.
// `tone` drives the colour tint on the dashboard mood-strip cell.
export const MOODS = [
  // ── high-energy positive ──
  { key: 'joyful',   emoji: '😊', label: 'joyful',   tone: 'emerald', group: 'positive' },
  { key: 'grateful', emoji: '🙏', label: 'grateful', tone: 'emerald', group: 'positive' },
  { key: 'awe',      emoji: '✨', label: 'awe',      tone: 'emerald', group: 'positive' },
  { key: 'loved',    emoji: '🥰', label: 'loved',    tone: 'emerald', group: 'positive' },
  { key: 'blessed',  emoji: '🌟', label: 'blessed',  tone: 'emerald', group: 'positive' },
  { key: 'excited',  emoji: '🤩', label: 'excited',  tone: 'emerald', group: 'positive' },
  { key: 'proud',    emoji: '🦁', label: 'proud',    tone: 'emerald', group: 'positive' },
  { key: 'playful',  emoji: '😄', label: 'playful',  tone: 'emerald', group: 'positive' },
  { key: 'radiant',  emoji: '🌞', label: 'radiant',  tone: 'emerald', group: 'positive' },
  { key: 'delighted',emoji: '😁', label: 'delighted',tone: 'emerald', group: 'positive' },
  { key: 'thankful', emoji: '🙌', label: 'thankful', tone: 'emerald', group: 'positive' },

  // ── focused / steady ──
  { key: 'focused',  emoji: '🎯', label: 'focused',  tone: 'sapphire', group: 'steady' },
  { key: 'steady',   emoji: '🙂', label: 'steady',   tone: '',         group: 'steady' },
  { key: 'centered', emoji: '🧘', label: 'centered', tone: 'sapphire', group: 'steady' },
  { key: 'curious',  emoji: '🤔', label: 'curious',  tone: 'sapphire', group: 'steady' },
  { key: 'creative', emoji: '💡', label: 'creative', tone: 'sapphire', group: 'steady' },
  { key: 'hopeful',  emoji: '🌅', label: 'hopeful',  tone: 'sapphire', group: 'steady' },
  { key: 'clear',    emoji: '🧠', label: 'clear',    tone: 'sapphire', group: 'steady' },
  { key: 'grounded', emoji: '🪨', label: 'grounded', tone: 'sapphire', group: 'steady' },
  { key: 'determined', emoji: '💪', label: 'determined', tone: 'sapphire', group: 'steady' },

  // ── low / tired ──
  { key: 'tired',    emoji: '😴', label: 'tired',    tone: 'clay',   group: 'low' },
  { key: 'drained',  emoji: '🪫', label: 'drained',  tone: 'clay',   group: 'low' },
  { key: 'meh',      emoji: '😐', label: 'meh',      tone: 'clay',   group: 'low' },
  { key: 'lonely',   emoji: '🥲', label: 'lonely',   tone: 'violet', group: 'low' },
  { key: 'low',      emoji: '😔', label: 'low',      tone: 'violet', group: 'low' },
  { key: 'sad',      emoji: '😢', label: 'sad',      tone: 'violet', group: 'low' },
  { key: 'weary',    emoji: '🥱', label: 'weary',    tone: 'clay',   group: 'low' },
  { key: 'numb',     emoji: '😶', label: 'numb',     tone: 'violet', group: 'low' },
  { key: 'tender',   emoji: '🫠', label: 'tender',   tone: 'violet', group: 'low' },

  // ── anxious / heavy ──
  { key: 'anxious',  emoji: '😣', label: 'anxious',  tone: 'amber', group: 'heavy' },
  { key: 'stressed', emoji: '😖', label: 'stressed', tone: 'amber', group: 'heavy' },
  { key: 'fearful',  emoji: '😨', label: 'fearful',  tone: 'amber', group: 'heavy' },
  { key: 'confused', emoji: '😵‍💫', label: 'confused', tone: 'amber', group: 'heavy' },
  { key: 'restless', emoji: '🫨', label: 'restless', tone: 'amber', group: 'heavy' },
  { key: 'pressured',emoji: '😮‍💨', label: 'pressured', tone: 'amber', group: 'heavy' },
  { key: 'ashamed',  emoji: '🫥', label: 'ashamed',  tone: 'amber', group: 'heavy' },
  { key: 'waiting',  emoji: '⏳', label: 'waiting',  tone: 'amber', group: 'heavy' },

  // ── fire / fight ──
  { key: 'angry',     emoji: '😤', label: 'angry',     tone: 'ruby', group: 'fire' },
  { key: 'fierce',    emoji: '🔥', label: 'fierce',    tone: 'ruby', group: 'fire' },
  { key: 'frustrated',emoji: '😩', label: 'frustrated',tone: 'ruby', group: 'fire' },
  { key: 'warring',   emoji: '⚔️', label: 'warring',   tone: 'ruby', group: 'fire' },
  { key: 'bold',      emoji: '🛡️', label: 'bold',      tone: 'ruby', group: 'fire' },
  { key: 'urgent',    emoji: '⚡', label: 'urgent',    tone: 'ruby', group: 'fire' },

  // ── spiritual ──
  { key: 'praying',   emoji: '🕊️', label: 'praying',   tone: 'sapphire', group: 'faith' },
  { key: 'fasting',   emoji: '🌾', label: 'fasting',   tone: 'sapphire', group: 'faith' },
  { key: 'worshipful',emoji: '🎵', label: 'worshipful',tone: 'emerald',  group: 'faith' },
  { key: 'broken',    emoji: '💔', label: 'broken',    tone: 'violet',   group: 'faith' },
  { key: 'restored',  emoji: '🌱', label: 'restored',  tone: 'emerald',  group: 'faith' },
  { key: 'expectant', emoji: '🌈', label: 'expectant', tone: 'emerald',  group: 'faith' },
  { key: 'surrendered', emoji: '🙇', label: 'surrendered', tone: 'sapphire', group: 'faith' },
  { key: 'anointed',    emoji: '🛢️', label: 'anointed',    tone: 'emerald',  group: 'faith' },
  { key: 'watchful',    emoji: '👀', label: 'watchful',    tone: 'sapphire', group: 'faith' },
];

export const MOOD_GROUPS = [
  { id: 'positive', label: 'good'      },
  { id: 'steady',   label: 'focused'   },
  { id: 'low',      label: 'low'       },
  { id: 'heavy',    label: 'heavy'     },
  { id: 'fire',     label: 'fire'      },
  { id: 'faith',    label: 'faith'     },
];

const moodMap = Object.fromEntries(MOODS.map(m => [m.key, m]));
export function moodInfo(key) { return moodMap[key] || moodMap.steady; }

const MOOD_SCORE = {
  radiant: 96, delighted: 94, joyful: 92, blessed: 90, excited: 88, thankful: 88,
  grateful: 86, loved: 84, playful: 82, proud: 80, restored: 84, worshipful: 82,
  expectant: 78, hopeful: 76, anointed: 76, awe: 74, focused: 72, clear: 70,
  determined: 68, grounded: 64, centered: 62, steady: 58, praying: 56, watchful: 54,
  curious: 54, creative: 54, fasting: 50, surrendered: 48, waiting: 44, meh: 42,
  tired: 38, weary: 34, drained: 30, tender: 30, lonely: 28, low: 24, sad: 20,
  numb: 18, broken: 16, confused: 28, restless: 32, pressured: 30, anxious: 26,
  stressed: 24, ashamed: 18, fearful: 16, frustrated: 28, angry: 24, fierce: 58,
  bold: 62, urgent: 42, warring: 44,
};

const QUICK_MOODS = ['joyful', 'grateful', 'focused', 'steady', 'tired', 'anxious', 'fierce', 'praying', 'worshipful', 'expectant'];

export function moodScore(key) {
  return Math.max(0, Math.min(100, MOOD_SCORE[key] ?? 50));
}

/** Save today's mood. Creates a daily entry if none exists. */
export async function logMood(moodKey, dateStr = new Date().toISOString().slice(0, 10)) {
  const entry = (await get('daily', dateStr)) || { date: dateStr, oneSentence: '', gratitude: ['','',''], freeform: '' };
  entry.mood    = moodKey;
  entry.moodAt  = new Date().toISOString();
  await put('daily', entry);
  window.dispatchEvent(new CustomEvent('mood:changed', { detail: { date: dateStr, mood: moodKey } }));
  return entry;
}

/** Pull last N days of moods, oldest → newest. */
export async function moodHistory(days = 14) {
  const daily = await all('daily').catch(() => []);
  const map = new Map(daily.map(d => [d.date, d.mood || null]));
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push({ date: iso, mood: map.get(iso) || null });
  }
  return out;
}

/** Render a tabbed mood picker with grouped emojis. */
export function renderMoodPicker(host, { selected, onPick } = {}) {
  const selectedGroup = MOODS.find(m => m.key === selected)?.group || 'positive';
  host.innerHTML = `
    <div class="mood-picker-wrap" role="group" aria-label="mood for today">
      <div class="mood-tabs" role="tablist">
        ${MOOD_GROUPS.map(g => `
          <button type="button" class="mood-tab ${g.id === selectedGroup ? 'is-active' : ''}" role="tab"
            data-group="${g.id}" aria-selected="${g.id === selectedGroup}">
            ${g.label}
          </button>
        `).join('')}
      </div>
      <div class="mood-picker" id="mood-grid"></div>
      ${selected ? `<div class="mood-selected">currently: <strong>${moodInfo(selected).emoji} ${moodInfo(selected).label}</strong></div>` : ''}
    </div>
  `;

  const grid = host.querySelector('#mood-grid');
  const paintGrid = (groupId) => {
    grid.innerHTML = MOODS.filter(m => m.group === groupId).map(m => `
      <button type="button"
        class="mood-chip ${selected === m.key ? 'is-active' : ''}"
        data-mood="${m.key}"
        aria-label="${m.label}"
        title="${m.label}">
        <span class="mood-emoji">${m.emoji}</span>
        <span class="mood-label">${m.label}</span>
      </button>
    `).join('');
    grid.querySelectorAll('.mood-chip').forEach(btn => {
      btn.addEventListener('click', async () => {
        const key = btn.dataset.mood;
        selected = key;
        await logMood(key);
        grid.querySelectorAll('.mood-chip').forEach(b => b.classList.toggle('is-active', b === btn));
        const sel = host.querySelector('.mood-selected');
        const info = moodInfo(key);
        if (sel) sel.innerHTML = `currently: <strong>${info.emoji} ${info.label}</strong>`;
        else host.querySelector('.mood-picker-wrap').insertAdjacentHTML('beforeend', `<div class="mood-selected">currently: <strong>${info.emoji} ${info.label}</strong></div>`);
        onPick?.(key);
      });
    });
  };
  paintGrid(selectedGroup);

  host.querySelectorAll('.mood-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      host.querySelectorAll('.mood-tab').forEach(t => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      paintGrid(tab.dataset.group);
    });
  });
}

/** Render a compact 14-day strip + simple analytics for the dashboard. */
export async function renderMoodStrip() {
  const history = await moodHistory(14);
  const filled = history.filter(d => d.mood);
  const dominant = (() => {
    if (filled.length === 0) return null;
    const counts = {};
    for (const d of filled) counts[d.mood] = (counts[d.mood] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  })();
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayMood = history.find(d => d.date === todayIso)?.mood || null;
  const hasGaugeMood = !!(todayMood || dominant);
  const gaugeMood = todayMood || dominant;
  const gaugeInfo = hasGaugeMood ? moodInfo(gaugeMood) : { emoji: '', label: 'choose a feeling', tone: 'neutral' };
  const gaugeScore = hasGaugeMood ? moodScore(gaugeMood) : 0;
  const gaugeLabel = todayMood ? 'today' : dominant ? 'mostly lately' : 'not logged yet';
  const quickButtons = QUICK_MOODS.map(key => {
    const info = moodInfo(key);
    return `
      <button type="button" class="mood-quick ${todayMood === key ? 'is-active' : ''}" data-mood-quick="${key}" title="${info.label}">
        <span>${info.emoji}</span>
        <small>${info.label}</small>
      </button>
    `;
  }).join('');

  const cells = history.map(d => {
    const info = d.mood ? moodInfo(d.mood) : null;
    const isToday = d.date === todayIso;
    const dayNum = d.date.slice(-2);
    return `
      <div class="mood-cell ${info ? 'is-' + info.tone : 'is-empty'} ${isToday ? 'is-today' : ''}"
           title="${d.date}${info ? ' · ' + info.label : ' · no mood'}">
        <div class="mood-cell-emoji">${info ? info.emoji : '·'}</div>
        <div class="mood-cell-day">${dayNum}</div>
      </div>
    `;
  }).join('');

  const summary = filled.length === 0
    ? `<span class="meta">no moods logged yet — tap an emoji on /today</span>`
    : `<span class="meta">${filled.length}/14 days logged${dominant ? ` · mostly <strong>${moodInfo(dominant).emoji} ${moodInfo(dominant).label}</strong>` : ''}</span>`;

  return `
    <section class="dash-section mood-gauge-section">
      <div class="label">feeling gauge · mood tracker</div>
      <div class="mood-trend">
        <div class="mood-gauge-card is-${gaugeInfo.tone || 'neutral'}">
          <div class="mood-gauge-head">
            <div>
              <div class="mood-gauge-kicker">${gaugeLabel}</div>
              <div class="mood-gauge-name">${gaugeInfo.emoji ? `${gaugeInfo.emoji} ` : ''}${gaugeInfo.label}</div>
            </div>
            <div class="mood-gauge-score num">${gaugeScore}</div>
          </div>
          <div class="mood-gauge-track" aria-label="feeling level ${gaugeScore} out of 100">
            <span style="width:${gaugeScore}%"></span>
            ${hasGaugeMood ? `<i style="left:${gaugeScore}%">${gaugeInfo.emoji}</i>` : ''}
          </div>
          <div class="mood-quick-row">${quickButtons}</div>
        </div>
        <div class="mood-strip">${cells}</div>
        <div class="mood-trend-foot">${summary}</div>
      </div>
    </section>
  `;
}
