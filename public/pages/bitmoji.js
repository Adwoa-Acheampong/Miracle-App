// bitmoji.js — Customize a personal avatar. Subscription tiers unlock outfits.
// The bitmoji pops into random corners of the app from time to time.

import { get, put } from '../store.js';
import { loadUser, firstName } from '../user.js';

import { esc } from '../util/esc.js';
const GENDERS = [
  { id: 'feminine',  label: 'female' },
  { id: 'masculine', label: 'male' },
];
const SKIN_TONES   = [
  ['#3D2914', 'umber'],
  ['#5D3A1A', 'cocoa'],
  ['#7A4A23', 'cinnamon'],
  ['#9C6B3F', 'caramel'],
  ['#B8865B', 'honey'],
  ['#D4A574', 'wheat'],
];
const HAIR_STYLES  = ['short', 'twists', 'afro', 'braids', 'locs', 'shaved'];
const HAIR_COLORS  = [
  ['#0A0A0A', 'jet'],
  ['#3B2417', 'espresso'],
  ['#7C5A3F', 'mahogany'],
  ['#C0392B', 'henna'],
  ['#D4A24E', 'gold (premium)'],
  ['#9B59B6', 'amethyst (premium)'],
];
const OUTFITS = [
  { id: 'classic',     label: 'black linen',       tier: 'free',     primary: '#050806', accent: '#D7A94D' },
  { id: 'emerald',     label: 'emerald set',       tier: 'free',     primary: '#0F8F6D', accent: '#19C58F' },
  { id: 'kente',       label: 'gold kente',        tier: 'premium',  primary: '#D7A94D', accent: '#0F8F6D' },
  { id: 'adwoa',       label: 'sunday glow',       tier: 'premium',  primary: '#111712', accent: '#D7A94D' },
  { id: 'minister',    label: 'minister robes',    tier: 'kingdom',  primary: '#030504', accent: '#D7A94D' },
  { id: 'warrior',     label: 'watchman armor',    tier: 'kingdom',  primary: '#050806', accent: '#19C58F' },
];
const TIERS = [
  { id: 'free',     label: 'free',         price: 'GHS 0/mo',   color: 'var(--ink-2)',      perks: ['2 outfits', '4 hair styles', 'basic skin palette'] },
  { id: 'premium',  label: 'premium',      price: 'GHS 30/mo',  color: 'var(--color-gold)', perks: ['6 outfits', 'all hair + premium hair colors', 'animations', 'corner popups'] },
  { id: 'kingdom',  label: 'kingdom',      price: 'GHS 60/mo',  color: 'var(--emerald)',    perks: ['all current + future drops', 'ministerial robes', 'crown accessories', 'guest invites'] },
];
const EXPRESSIONS = [
  { id: 'steady', label: 'steady', tier: 'free' },
  { id: 'joyful', label: 'joyful', tier: 'free' },
  { id: 'focused', label: 'focused', tier: 'free' },
  { id: 'prayer', label: 'prayer', tier: 'premium' },
  { id: 'spark', label: 'spark', tier: 'kingdom' },
];
const AURAS = [
  { id: 'none', label: 'none', tier: 'free' },
  { id: 'halo', label: 'halo', tier: 'free' },
  { id: 'fireflies', label: 'fireflies', tier: 'premium' },
  { id: 'anointing', label: 'anointing', tier: 'kingdom' },
];
const ACCESSORIES = [
  { id: 'none', label: 'none', tier: 'free' },
  { id: 'hoops', label: 'gold hoops', tier: 'free' },
  { id: 'glasses', label: 'focus glasses', tier: 'premium' },
  { id: 'headwrap', label: 'emerald wrap', tier: 'premium' },
  { id: 'crown', label: 'small crown', tier: 'kingdom' },
];
const MOJI_ACTIONS = [
  { id: 'idle', label: 'still' },
  { id: 'wave', label: 'wave' },
  { id: 'sip', label: 'tea' },
  { id: 'read', label: 'read' },
  { id: 'pray', label: 'pray' },
  { id: 'banner', label: 'banner' },
];

const TIER_RANK = { free: 0, premium: 1, kingdom: 2 };

function tierAllows(current = 'free', required = 'free') {
  return (TIER_RANK[current] ?? 0) >= (TIER_RANK[required] ?? 0);
}
function isOutfitLocked(outfit, tier) {
  return !tierAllows(tier, outfit.tier);
}

function normalizeBitmojiConfig(cfg) {
  cfg.tier = cfg.tier || 'free';
  cfg.gender = cfg.gender || 'feminine';
  if (cfg.gender === 'androgynous') cfg.gender = 'feminine';
  cfg.skinTone = Number.isInteger(cfg.skinTone) ? cfg.skinTone : 0;
  cfg.hairColor = Number.isInteger(cfg.hairColor) ? cfg.hairColor : 0;
  cfg.hairStyle = HAIR_STYLES.includes(cfg.hairStyle) ? cfg.hairStyle : 'short';
  cfg.popups = cfg.popups === 'off' ? 'off' : 'on';

  if (cfg.tier === 'free' && cfg.hairColor > 3) cfg.hairColor = 0;
  if (!OUTFITS.some(o => o.id === cfg.outfit && !isOutfitLocked(o, cfg.tier))) {
    cfg.outfit = OUTFITS.find(o => !isOutfitLocked(o, cfg.tier))?.id || 'emerald';
  }

  [
    ['expression', EXPRESSIONS],
    ['aura', AURAS],
    ['accessory', ACCESSORIES],
  ].forEach(([prop, list]) => {
    const current = list.find(item => item.id === cfg[prop]);
    if (!current || !tierAllows(cfg.tier, current.tier)) {
      cfg[prop] = list.find(item => tierAllows(cfg.tier, item.tier))?.id || list[0].id;
    }
  });

  return cfg;
}

function renderLockedChip(item, cfg, prop) {
  const locked = !tierAllows(cfg.tier, item.tier);
  const active = cfg[prop] === item.id;
  return `
    <button class="bm-chip ${active ? 'is-active' : ''} ${locked ? 'is-locked' : ''}"
            data-prop="${prop}" data-val="${item.id}" data-locked="${locked ? '1' : ''}"
            title="${locked ? `${item.label} unlocks on ${item.tier}` : item.label}">
      <span>${esc(item.label)}</span>
      ${locked ? '<small>locked</small>' : ''}
    </button>
  `;
}

export async function render() {
  const user = await loadUser();
  const cfg = (await get('meta', 'bitmoji'))?.value || {
    gender: 'feminine',
    skinTone: 0,
    hairStyle: 'short',
    hairColor: 0,
    outfit: 'emerald',
    expression: 'steady',
    aura: 'halo',
    accessory: 'hoops',
    tier: 'free',
    popups: 'on',
  };
  normalizeBitmojiConfig(cfg);

  const root = document.createElement('div');
  root.className = 'page page-wide';
  root.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">moji · ${esc(firstName(user) || 'you')}</h1>
      <span class="page-meta">your avatar in miracle · pops into corners doing random things</span>
    </div>

    <div class="bm-charity-banner">
      <div class="bm-charity-title">subscriptions are a charity · not a paywall</div>
      <div class="bm-charity-body">
        every cedi from <em>premium</em> and <em>kingdom</em> goes to the
        <strong>orphans, widows, and church-builder fund</strong> directed by adwoa.
        the free tier journals everything you need — upgrade only if you want to give while you build.
      </div>
    </div>

    <div class="bitmoji-stage">
      <div class="bitmoji-canvas" id="bitmoji-preview">
        <div class="moji-svg-fallback" aria-hidden="true">
          <div class="moji-orbit" aria-hidden="true"></div>
          ${renderBitmoji(cfg)}
        </div>
      </div>
      <div class="bitmoji-meta">
        <div class="bm-tier-badge tier-${cfg.tier}">${cfg.tier}</div>
        <div class="bm-name">${esc(firstName(user) || 'guest')}</div>
        <div class="bm-blurb">avatar pops into corners of the app at random moments. <em>doing random things.</em></div>
        <div class="bm-personality-row">
          <span>${esc(cfg.expression || 'steady')}</span>
          <span>${esc(cfg.aura || 'halo')}</span>
          <span>${esc(cfg.accessory || 'none')}</span>
        </div>
        <div class="bm-action-row" aria-label="Moji action preview">
          ${MOJI_ACTIONS.map((item, index) => `
            <button class="bm-action-chip ${index === 0 ? 'is-active' : ''}" data-moji-action="${item.id}" type="button">${item.label}</button>
          `).join('')}
        </div>
      </div>
    </div>

    <section class="dash-section">
      <div class="label">gender · silhouette</div>
      <div class="bm-row">
        ${GENDERS.map(g => `
          <button class="bm-chip ${cfg.gender === g.id ? 'is-active' : ''}" data-prop="gender" data-val="${g.id}">${g.label}</button>
        `).join('')}
      </div>
    </section>

    <section class="dash-section">
      <div class="label">expression</div>
      <div class="bm-row">
        ${EXPRESSIONS.map(x => renderLockedChip(x, cfg, 'expression')).join('')}
      </div>
    </section>

    <section class="dash-section">
      <div class="label">aura</div>
      <div class="bm-row">
        ${AURAS.map(x => renderLockedChip(x, cfg, 'aura')).join('')}
      </div>
    </section>

    <section class="dash-section">
      <div class="label">accessory</div>
      <div class="bm-row">
        ${ACCESSORIES.map(x => renderLockedChip(x, cfg, 'accessory')).join('')}
      </div>
    </section>

    <section class="dash-section">
      <div class="label">skin tone</div>
      <div class="bm-row">
        ${SKIN_TONES.map((s, i) => `
          <button class="bm-swatch ${cfg.skinTone === i ? 'is-active' : ''}" data-prop="skinTone" data-val="${i}" title="${esc(s[1])}" style="background: ${s[0]}"></button>
        `).join('')}
      </div>
    </section>

    <section class="dash-section">
      <div class="label">hair style</div>
      <div class="bm-row">
        ${HAIR_STYLES.map(h => `
          <button class="bm-chip ${cfg.hairStyle === h ? 'is-active' : ''}" data-prop="hairStyle" data-val="${h}">${h}</button>
        `).join('')}
      </div>
    </section>

    <section class="dash-section">
      <div class="label">hair color</div>
      <div class="bm-row">
        ${HAIR_COLORS.map((c, i) => `
          <button class="bm-swatch ${cfg.hairColor === i ? 'is-active' : ''} ${c[1].includes('premium') && cfg.tier === 'free' ? 'is-locked' : ''}"
                  data-prop="hairColor" data-val="${i}" data-locked="${c[1].includes('premium') && cfg.tier === 'free' ? '1' : ''}"
                  title="${esc(c[1])}" style="background: ${c[0]}">
            ${c[1].includes('premium') && cfg.tier === 'free' ? '<span class="bm-lock">⌖</span>' : ''}
          </button>
        `).join('')}
      </div>
    </section>

    <section class="dash-section">
      <div class="label">outfit</div>
      <div class="bm-outfit-grid">
        ${OUTFITS.map(o => {
          const locked = isOutfitLocked(o, cfg.tier);
          return `
            <button class="bm-outfit ${cfg.outfit === o.id ? 'is-active' : ''} ${locked ? 'is-locked' : ''}"
                    data-prop="outfit" data-val="${o.id}" data-locked="${locked ? '1' : ''}">
              <div class="bm-outfit-swatch" style="background: linear-gradient(135deg, ${o.primary}, ${o.accent})"></div>
              <div class="bm-outfit-label">${o.label}</div>
              <div class="bm-outfit-tier tier-${o.tier}">${o.tier}</div>
            </button>
          `;
        }).join('')}
      </div>
    </section>

    <section class="dash-section">
      <div class="label">subscription</div>
      <div class="bm-tier-grid">
        ${TIERS.map(t => `
          <button class="bm-tier-card ${cfg.tier === t.id ? 'is-active' : ''}" data-prop="tier" data-val="${t.id}" style="--accent: ${t.color}">
            <div class="bm-tier-name">${t.label}</div>
            <div class="bm-tier-price">${t.price}</div>
            <ul class="bm-tier-perks">
              ${t.perks.map(p => `<li>${esc(p)}</li>`).join('')}
            </ul>
            ${cfg.tier === t.id ? `<div class="bm-tier-active">current plan</div>` : `<div class="bm-tier-cta">upgrade</div>`}
          </button>
        `).join('')}
      </div>
    </section>

    <section class="dash-section">
      <div class="label">corner popups</div>
      <div class="bm-row">
        <span class="toggle ${cfg.popups === 'on' ? 'is-on' : ''}" id="bm-popups" role="switch" tabindex="0"></span>
        <span class="meta">let the bitmoji appear in random corners every few minutes · ${cfg.popups === 'on' ? 'on' : 'off'}</span>
      </div>
    </section>
  `;

  // Bind selectors
  root.querySelectorAll('[data-prop]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.locked === '1') {
        const banner = document.createElement('div');
        banner.className = 'bm-locked-toast';
        banner.textContent = 'locked · upgrade your subscription';
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 2200);
        return;
      }
      const prop = btn.dataset.prop;
      let val = btn.dataset.val;
      if (prop === 'skinTone' || prop === 'hairColor') val = Number(val);
      cfg[prop] = val;
      await put('meta', { key: 'bitmoji', value: cfg });
      root.__threeMojiCleanup?.();
      root.replaceWith(await render());
    });
  });

  root.querySelector('#bm-popups')?.addEventListener('click', async () => {
    cfg.popups = cfg.popups === 'on' ? 'off' : 'on';
    await put('meta', { key: 'bitmoji', value: cfg });
    root.__threeMojiCleanup?.();
    root.replaceWith(await render());
  });

  bindMojiPreview(root, cfg);

  return root;
}

function bindMojiPreview(root, cfg) {
  const preview = root.querySelector('#bitmoji-preview');
  const fallback = root.querySelector('.moji-svg-fallback');
  if (!preview || !fallback) return;

  let currentAction = 'idle';
  const actionIds = MOJI_ACTIONS.map(item => item.id);

  const setAction = action => {
    currentAction = action || 'idle';
    preview.dataset.action = currentAction;
    root.querySelectorAll('.bm-action-chip[data-moji-action]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.mojiAction === currentAction);
    });
    fallback.innerHTML = `
      <div class="moji-orbit" aria-hidden="true"></div>
      ${renderBitmoji(cfg, { action: currentAction })}
    `;
  };

  root.querySelectorAll('.bm-action-chip[data-moji-action]').forEach(btn => {
    btn.addEventListener('click', () => setAction(btn.dataset.mojiAction));
  });
  preview.addEventListener('click', () => {
    const index = actionIds.indexOf(currentAction);
    setAction(actionIds[(index + 1) % actionIds.length] || 'idle');
  });
  root.__threeMojiCleanup = () => {};
  setAction(currentAction);
}

// SVG bitmoji generator — distinct silhouettes per gender.
// Restraint over caricature: softer eyes, subtle mouth, no clown grin.
export function renderBitmoji(cfg, opts = {}) {
  const skin = SKIN_TONES[cfg.skinTone || 0][0];
  const hair = HAIR_COLORS[cfg.hairColor || 0][0];
  const outfit = OUTFITS.find(o => o.id === cfg.outfit) || OUTFITS[0];
  const hairPath = hairPathFor(cfg.hairStyle || 'short');
  const gender   = cfg.gender || 'feminine';
  const action = opts.action || cfg.action || '';
  const expression = opts.expression || cfg.expression || (action === 'pray' ? 'prayer' : action === 'laugh' ? 'joyful' : 'steady');
  const aura = cfg.aura || 'halo';
  const accessory = cfg.accessory || 'none';
  const body     = bodyPathFor(gender);
  const lipPath  = lipPathFor(gender, skin, expression);
  const browStroke = gender === 'masculine' ? 2 : 1.6;
  const skinShade = shade(skin, -18);

  return `
    <svg viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg" class="bitmoji-svg bm-action-${action || 'idle'}">
      <defs>
        <radialGradient id="mojiGlow" cx="50%" cy="38%" r="58%">
          <stop offset="0%" stop-color="#D7A94D" stop-opacity="0.42"/>
          <stop offset="46%" stop-color="#19C58F" stop-opacity="0.16"/>
          <stop offset="100%" stop-color="#050806" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="mojiGold" x1="0%" x2="100%">
          <stop offset="0%" stop-color="#EFD18A"/>
          <stop offset="100%" stop-color="#A8781D"/>
        </linearGradient>
      </defs>
      ${auraSvgFor(aura)}
      <ellipse class="moji-ground-shadow" cx="100" cy="264" rx="54" ry="7" fill="#000" opacity="0.22"/>

      ${legsSvgFor(gender, skin, outfit)}

      <!-- Outfit/body -->
      <path class="moji-body-shape" d="${body}" fill="${outfit.primary}"/>
      <path d="${body}" fill="none" stroke="${outfit.accent}" stroke-width="1.4" opacity="0.7"/>
      ${armsSvgFor(action, gender, skin, outfit)}

      <!-- Neck -->
      <rect x="${gender === 'masculine' ? 84 : 88}" y="134" width="${gender === 'masculine' ? 32 : 24}" height="20" fill="${skin}"/>
      <path d="M${gender === 'masculine' ? 84 : 88} 152 Q100 156 ${gender === 'masculine' ? 116 : 112} 152" fill="none" stroke="${skinShade}" stroke-width="1" opacity="0.5"/>

      <!-- Head -->
      <ellipse cx="100" cy="95" rx="${gender === 'masculine' ? 46 : 42}" ry="${gender === 'masculine' ? 52 : 50}" fill="${skin}"/>

      <!-- Cheek warmth — feminine only; on a young man it reads as smile lines -->
      ${gender === 'feminine' ? `
        <ellipse cx="74"  cy="108" rx="6" ry="3" fill="${shade(skin, 12)}" opacity="0.45"/>
        <ellipse cx="126" cy="108" rx="6" ry="3" fill="${shade(skin, 12)}" opacity="0.45"/>
      ` : ''}

      <!-- Hair -->
      <g fill="${hair}">${hairPath}</g>

      ${eyesSvgFor(expression, gender)}

      <!-- Stubble (masculine) — light dot pattern on the jaw, not a beard outline -->
      ${gender === 'masculine' ? `
        <g fill="${hair}" opacity="0.35">
          <circle cx="84"  cy="123" r="0.6"/>
          <circle cx="88"  cy="126" r="0.6"/>
          <circle cx="92"  cy="128" r="0.6"/>
          <circle cx="96"  cy="129" r="0.6"/>
          <circle cx="100" cy="130" r="0.6"/>
          <circle cx="104" cy="129" r="0.6"/>
          <circle cx="108" cy="128" r="0.6"/>
          <circle cx="112" cy="126" r="0.6"/>
          <circle cx="116" cy="123" r="0.6"/>
        </g>
      ` : ''}

      <!-- Eyebrows — kept higher on masculine for a younger, brighter face -->
      <path d="M76 ${gender === 'masculine' ? 84 : 86} Q82 ${gender === 'masculine' ? 81 : 84} 88 ${gender === 'masculine' ? 84 : 86}" fill="none" stroke="${hair}" stroke-width="${browStroke}" stroke-linecap="round"/>
      <path d="M112 ${gender === 'masculine' ? 84 : 86} Q118 ${gender === 'masculine' ? 81 : 84} 124 ${gender === 'masculine' ? 84 : 86}" fill="none" stroke="${hair}" stroke-width="${browStroke}" stroke-linecap="round"/>

      <!-- Nose — bridge shadow + soft tip -->
      <path d="M99 104 Q98 112 100 116 Q102 112 101 104" fill="none" stroke="${skinShade}" stroke-width="0.9" opacity="0.55"/>
      <circle cx="100" cy="117" r="1.2" fill="${skinShade}" opacity="0.35"/>

      <!-- Lips/smile (gender-aware) -->
      ${lipPath}

      ${expressionSvgFor(expression, outfit, skin)}
      ${accessorySvgFor(accessory, gender, outfit, hair)}
      ${actionPropSvgFor(action, outfit)}

      <!-- Tier badge (kingdom = gold crown) -->
      ${cfg.tier === 'kingdom' ? '<path d="M78 44 L88 54 L98 40 L108 54 L118 40 L124 52 L124 58 L78 58 Z" fill="#D4A24E" stroke="#7C5A1F" stroke-width="0.8"/>' : ''}
    </svg>
  `;
}

function auraSvgFor(aura) {
  if (aura === 'halo') {
    return `
      <ellipse cx="100" cy="57" rx="46" ry="10" fill="none" stroke="url(#mojiGold)" stroke-width="4" opacity="0.86"/>
      <ellipse cx="100" cy="57" rx="58" ry="14" fill="none" stroke="#19C58F" stroke-width="1" opacity="0.32"/>
    `;
  }
  if (aura === 'fireflies') {
    return `
      <circle class="moji-firefly f1" cx="42" cy="64" r="2.4" fill="#EFD18A"/>
      <circle class="moji-firefly f2" cx="158" cy="82" r="2" fill="#19C58F"/>
      <circle class="moji-firefly f3" cx="54" cy="166" r="1.9" fill="#EFD18A"/>
      <circle class="moji-firefly f4" cx="148" cy="142" r="2.2" fill="#19C58F"/>
      <ellipse cx="100" cy="120" rx="78" ry="92" fill="url(#mojiGlow)" opacity="0.55"/>
    `;
  }
  if (aura === 'anointing') {
    return `
      <ellipse cx="100" cy="118" rx="76" ry="100" fill="url(#mojiGlow)" opacity="0.7"/>
      <path d="M100 26 C88 44 88 58 100 66 C112 58 112 44 100 26 Z" fill="url(#mojiGold)" opacity="0.82"/>
      <path d="M100 31 C94 45 95 54 100 59 C105 54 106 45 100 31 Z" fill="#050806" opacity="0.32"/>
    `;
  }
  return '';
}

function eyesSvgFor(expression, gender) {
  const lashes = gender === 'feminine'
    ? `
      <path d="M76 95 Q82 91 88 95" fill="none" stroke="#1A0F0A" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M112 95 Q118 91 124 95" fill="none" stroke="#1A0F0A" stroke-width="1.1" stroke-linecap="round"/>
    `
    : '';

  if (expression === 'prayer') {
    return `
      <path d="M75 96 Q82 101 89 96" fill="none" stroke="#1A0F0A" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M111 96 Q118 101 125 96" fill="none" stroke="#1A0F0A" stroke-width="1.4" stroke-linecap="round"/>
    `;
  }
  if (expression === 'joyful') {
    return `
      <path d="M75 96 Q82 91 89 96" fill="none" stroke="#1A0F0A" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M111 96 Q118 91 125 96" fill="none" stroke="#1A0F0A" stroke-width="1.6" stroke-linecap="round"/>
      ${lashes}
    `;
  }
  if (expression === 'focused') {
    return `
      <path d="M75 96 Q82 93 89 96 Q82 99 75 96 Z" fill="#FFFFFF"/>
      <path d="M111 96 Q118 93 125 96 Q118 99 111 96 Z" fill="#FFFFFF"/>
      <ellipse cx="82" cy="96" rx="2.5" ry="2.9" fill="#1A0F0A"/>
      <ellipse cx="118" cy="96" rx="2.5" ry="2.9" fill="#1A0F0A"/>
      <circle cx="82.9" cy="95" r="0.8" fill="#FFFFFF"/>
      <circle cx="118.9" cy="95" r="0.8" fill="#FFFFFF"/>
    `;
  }
  return `
    <path d="M76 96 Q82 92 88 96 Q82 100 76 96 Z" fill="#FFFFFF"/>
    <path d="M112 96 Q118 92 124 96 Q118 100 112 96 Z" fill="#FFFFFF"/>
    <ellipse cx="82" cy="96" rx="2.2" ry="2.6" fill="#1A0F0A"/>
    <ellipse cx="118" cy="96" rx="2.2" ry="2.6" fill="#1A0F0A"/>
    <circle cx="82.8" cy="95" r="${gender === 'masculine' ? 0.9 : 0.7}" fill="#FFFFFF"/>
    <circle cx="118.8" cy="95" r="${gender === 'masculine' ? 0.9 : 0.7}" fill="#FFFFFF"/>
    ${lashes}
  `;
}

function expressionSvgFor(expression, outfit, skin) {
  if (expression === 'prayer') {
    const shadow = shade(skin, -22);
    return `
      <g opacity="0.96">
        <path d="M84 166 C82 154 86 144 96 140 C100 154 101 169 95 184 C91 180 87 174 84 166 Z" fill="${skin}" stroke="${shadow}" stroke-width="1"/>
        <path d="M116 166 C118 154 114 144 104 140 C100 154 99 169 105 184 C109 180 113 174 116 166 Z" fill="${skin}" stroke="${shadow}" stroke-width="1"/>
        <path d="M96 146 Q100 160 96 180" fill="none" stroke="#EFD18A" stroke-width="1.1" opacity="0.62"/>
        <path d="M104 146 Q100 160 104 180" fill="none" stroke="#EFD18A" stroke-width="1.1" opacity="0.62"/>
      </g>
    `;
  }
  if (expression === 'spark') {
    return `
      <g fill="url(#mojiGold)" opacity="0.95">
        <path d="M135 72 L139 82 L149 86 L139 90 L135 100 L131 90 L121 86 L131 82 Z"/>
        <circle cx="65" cy="72" r="2.2"/>
        <circle cx="150" cy="119" r="1.8"/>
      </g>
    `;
  }
  if (expression === 'focused') {
    return `<path d="M72 88 Q82 82 93 87 M107 87 Q118 82 128 88" fill="none" stroke="${outfit.accent}" stroke-width="1.2" stroke-linecap="round" opacity="0.62"/>`;
  }
  return '';
}

function accessorySvgFor(accessory, gender, outfit, hair) {
  if (accessory === 'hoops') {
    return `
      <circle cx="58" cy="104" r="${gender === 'feminine' ? 3.2 : 2.6}" fill="none" stroke="url(#mojiGold)" stroke-width="1.6"/>
      <circle cx="142" cy="104" r="${gender === 'feminine' ? 3.2 : 2.6}" fill="none" stroke="url(#mojiGold)" stroke-width="1.6"/>
    `;
  }
  if (accessory === 'glasses') {
    return `
      <g fill="none" stroke="#D7A94D" stroke-width="2" opacity="0.92">
        <rect x="68" y="88" width="29" height="20" rx="8"/>
        <rect x="103" y="88" width="29" height="20" rx="8"/>
        <path d="M97 98 L103 98"/>
        <path d="M68 97 L59 95 M132 97 L141 95"/>
      </g>
    `;
  }
  if (accessory === 'headwrap') {
    return `
      <g>
        <path d="M57 77 Q66 51 100 48 Q134 51 143 77 Q122 68 100 68 Q78 68 57 77 Z" fill="#0F8F6D" stroke="#D7A94D" stroke-width="1.2"/>
        <path d="M90 49 Q103 41 116 52 Q103 58 90 49 Z" fill="#D7A94D"/>
        <path d="M66 70 Q100 62 134 70" fill="none" stroke="#030504" stroke-width="1.1" opacity="0.45"/>
      </g>
    `;
  }
  if (accessory === 'crown') {
    return `<path d="M76 47 L87 57 L99 40 L111 57 L124 47 L121 64 L79 64 Z" fill="url(#mojiGold)" stroke="#050806" stroke-width="1.1"/>`;
  }
  if (accessory === 'none' && gender === 'feminine' && outfit.accent) {
    return `
      <circle cx="58" cy="104" r="1.6" fill="${outfit.accent}"/>
      <circle cx="142" cy="104" r="1.6" fill="${outfit.accent}"/>
    `;
  }
  return '';
}

function legsSvgFor(gender, skin, outfit) {
  const shoe = '#050806';
  const legShade = shade(skin, -18);
  if (gender === 'masculine') {
    return `
      <g class="moji-legs">
        <path d="M76 220 L96 220 L93 258 L77 258 Z" fill="${shade(outfit.primary, -18)}"/>
        <path d="M104 220 L124 220 L123 258 L107 258 Z" fill="${shade(outfit.primary, -18)}"/>
        <path d="M75 257 Q85 253 98 258 L98 265 L72 265 Q70 261 75 257 Z" fill="${shoe}"/>
        <path d="M104 258 Q118 253 128 258 Q132 261 129 265 L104 265 Z" fill="${shoe}"/>
      </g>
    `;
  }
  return `
    <g class="moji-legs">
      <path d="M81 224 L96 224 L94 258 L80 258 Z" fill="${skin}"/>
      <path d="M104 224 L119 224 L120 258 L106 258 Z" fill="${skin}"/>
      <path d="M79 255 Q89 252 100 258 L100 265 L76 265 Q73 260 79 255 Z" fill="${shoe}"/>
      <path d="M102 258 Q113 252 124 255 Q128 260 124 265 L102 265 Z" fill="${shoe}"/>
      <path d="M81 224 L96 224 L95 232 L81 232 Z" fill="${legShade}" opacity="0.42"/>
      <path d="M104 224 L119 224 L119 232 L105 232 Z" fill="${legShade}" opacity="0.42"/>
    </g>
  `;
}

function armsSvgFor(action, gender, skin, outfit) {
  const shadow = shade(skin, -22);
  if (action === 'sip') {
    return `
      <g class="moji-arm moji-arm-left">
        <path d="M63 158 Q49 180 50 211" fill="none" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
        <path d="M63 158 Q49 180 50 211" fill="none" stroke="${shadow}" stroke-width="1.2" opacity="0.38"/>
      </g>
      <g class="moji-arm moji-arm-right moji-sip-arm">
        <path d="M138 158 Q136 134 118 124" fill="none" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
        <path d="M138 158 Q136 134 118 124" fill="none" stroke="${shadow}" stroke-width="1.2" opacity="0.38"/>
        <circle cx="118" cy="124" r="6" fill="${skin}"/>
      </g>
    `;
  }
  if (action === 'pray') {
    return `
      <g class="moji-arm moji-pray-hands">
        <path d="M68 164 Q84 142 97 152" fill="none" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
        <path d="M132 164 Q116 142 103 152" fill="none" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
        <path d="M96 146 Q100 165 96 187" fill="none" stroke="${shadow}" stroke-width="1.1" opacity="0.45"/>
        <path d="M104 146 Q100 165 104 187" fill="none" stroke="${shadow}" stroke-width="1.1" opacity="0.45"/>
      </g>
    `;
  }
  if (action === 'read') {
    return `
      <g class="moji-arm">
        <path d="M66 164 Q76 188 92 196" fill="none" stroke="${skin}" stroke-width="13" stroke-linecap="round"/>
        <path d="M134 164 Q124 188 108 196" fill="none" stroke="${skin}" stroke-width="13" stroke-linecap="round"/>
      </g>
    `;
  }
  if (action === 'wave') {
    return `
      <g class="moji-arm moji-wave-arm">
        <path d="M61 158 Q46 138 37 113" fill="none" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
        <circle cx="37" cy="113" r="7" fill="${skin}"/>
      </g>
      <g class="moji-arm">
        <path d="M139 158 Q153 182 151 211" fill="none" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
      </g>
    `;
  }
  return `
    <g class="moji-arm">
      <path d="M62 158 Q48 183 50 213" fill="none" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
      <path d="M138 158 Q152 183 150 213" fill="none" stroke="${skin}" stroke-width="14" stroke-linecap="round"/>
    </g>
  `;
}

function actionPropSvgFor(action, outfit) {
  if (action === 'sip') {
    return `
      <g class="moji-tea-cup">
        <rect x="111" y="114" width="18" height="16" rx="4" fill="#050806" stroke="#D7A94D" stroke-width="1.4"/>
        <path d="M129 118 Q139 120 131 126" fill="none" stroke="#D7A94D" stroke-width="1.4"/>
        <path d="M115 111 Q116 106 114 102 M122 111 Q123 106 121 102" fill="none" stroke="#EFD18A" stroke-width="1" opacity="0.7"/>
      </g>
    `;
  }
  if (action === 'read') {
    return `
      <g class="moji-book-prop">
        <path d="M70 184 Q88 178 100 188 L100 214 Q87 204 70 210 Z" fill="#EFD18A" stroke="#7A5A18" stroke-width="1"/>
        <path d="M100 188 Q112 178 130 184 L130 210 Q113 204 100 214 Z" fill="#F7F1E5" stroke="#7A5A18" stroke-width="1"/>
        <path d="M100 188 L100 214" stroke="#7A5A18" stroke-width="1"/>
      </g>
    `;
  }
  if (action === 'banner') {
    return `
      <g class="moji-banner-ribbon">
        <path d="M38 188 H162 Q168 188 168 194 V218 Q168 224 162 224 H38 Q32 224 32 218 V194 Q32 188 38 188 Z" fill="#050806" stroke="#D7A94D" stroke-width="1.2"/>
        <path d="M42 198 H158 M42 212 H132" stroke="${outfit.accent}" stroke-width="1" opacity="0.55"/>
      </g>
    `;
  }
  return '';
}

// Darken/lighten a hex color by N% — used for skin shading and contour lines.
function shade(hex, pct) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const adj = v => Math.max(0, Math.min(255, Math.round(v + (pct / 100) * 255)));
  return '#' + [adj(r), adj(g), adj(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Body silhouettes — feminine has hip flare, masculine has broader shoulders.
// All centered on 100, going from neck base (150) down to bottom (240).
function bodyPathFor(gender) {
  if (gender === 'masculine') {
    // Broader shoulders, narrower hips
    return 'M32 198 Q32 158 60 148 L140 148 Q168 158 168 198 L166 226 L34 226 Z';
  }
  // feminine — narrow waist, hip flare
  return 'M46 198 Q46 162 72 152 L128 152 Q154 162 154 198 Q158 216 154 226 L46 226 Q42 216 46 198 Z';
}

function lipPathFor(gender, skin, expression = 'steady') {
  if (expression === 'prayer') {
    return `<path d="M94 126 Q100 128 106 126" fill="none" stroke="${shade(skin, -38)}" stroke-width="1.1" stroke-linecap="round" opacity="0.78"/>`;
  }
  if (expression === 'joyful') {
    return `<path d="M88 123 Q100 134 112 123" fill="none" stroke="${shade(skin, -42)}" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  if (expression === 'focused') {
    return `<path d="M93 126 Q100 125 107 126" fill="none" stroke="${shade(skin, -42)}" stroke-width="1.3" stroke-linecap="round"/>`;
  }
  if (expression === 'spark') {
    return `<path d="M90 124 Q100 131 110 124" fill="none" stroke="#D7A94D" stroke-width="1.8" stroke-linecap="round"/>`;
  }
  if (gender === 'feminine') {
    // Subtle natural lips — no clown grin, no painted-on cupid bow.
    // Upper lip is a filled shape; lower lip a gentle warm tone.
    const lipFill = shade(skin, -30);
    return `
      <path d="M91 124 Q95 122 100 123 Q105 122 109 124 Q105 126 100 125.5 Q95 126 91 124 Z" fill="${lipFill}" opacity="0.85"/>
      <path d="M93 125 Q100 128 107 125" fill="none" stroke="#3A1F12" stroke-width="0.7" stroke-linecap="round" opacity="0.6"/>
    `;
  }
  if (gender === 'masculine') {
    // Slight upturn — young, easy smile.
    return `<path d="M92 126 Q100 124 108 126" fill="none" stroke="${shade(skin, -40)}" stroke-width="1.2" stroke-linecap="round"/>`;
  }
  return `<path d="M93 125 Q100 127 107 125" fill="none" stroke="${shade(skin, -35)}" stroke-width="1.2" stroke-linecap="round"/>`;
}

function hairPathFor(style) {
  switch (style) {
    case 'shaved':  return ''; // bald
    case 'short':   return '<path d="M55 78 Q60 50 100 45 Q140 50 145 78 Q142 65 100 60 Q58 65 55 78 Z"/>';
    case 'twists':  return '<path d="M55 75 Q55 45 100 40 Q145 45 145 75 Q140 50 130 70 Q120 50 110 70 Q100 50 90 70 Q80 50 70 70 Q60 50 55 75 Z"/>';
    case 'afro':    return '<ellipse cx="100" cy="55" rx="60" ry="40"/>';
    case 'braids':  return '<path d="M55 75 Q55 45 100 40 Q145 45 145 75 L150 130 L140 130 L138 80 L130 130 L120 130 L118 80 L100 130 L82 80 L80 130 L70 130 L62 80 L60 130 L50 130 Z"/>';
    case 'locs':    return '<path d="M55 75 Q55 45 100 40 Q145 45 145 75 L150 140 L142 140 L140 80 L132 140 L124 140 L122 85 L114 140 L106 140 L104 80 L96 140 L88 85 L86 140 L78 140 L76 80 L68 140 L60 140 L58 85 L50 140 Z"/>';
    default:        return '<path d="M55 78 Q60 50 100 45 Q140 50 145 78 Q142 65 100 60 Q58 65 55 78 Z"/>';
  }
}
