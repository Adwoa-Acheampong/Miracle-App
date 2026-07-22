const SKIN_TONES = ['#3D2914', '#5D3A1A', '#7A4A23', '#9C6B3F', '#B8865B', '#D4A574'];
const HAIR_COLORS = ['#0A0A0A', '#3B2417', '#7C5A3F', '#C0392B', '#D4A24E', '#9B59B6'];
const OUTFITS = {
  classic:  { primary: '#050806', accent: '#D7A94D' },
  emerald:  { primary: '#0F8F6D', accent: '#19C58F' },
  kente:    { primary: '#D7A94D', accent: '#0F8F6D' },
  adwoa:    { primary: '#111712', accent: '#D7A94D' },
  minister: { primary: '#030504', accent: '#D7A94D' },
  warrior:  { primary: '#050806', accent: '#19C58F' },
};

export function renderMojiArt(cfg = {}, opts = {}) {
  const uid = `moji${Math.random().toString(36).slice(2, 8)}`;
  const gender = cfg.gender === 'masculine' ? 'masculine' : 'feminine';
  const skin = SKIN_TONES[Number.isInteger(cfg.skinTone) ? cfg.skinTone : 0] || SKIN_TONES[0];
  const hair = HAIR_COLORS[Number.isInteger(cfg.hairColor) ? cfg.hairColor : 0] || HAIR_COLORS[0];
  const outfit = OUTFITS[cfg.outfit] || OUTFITS.emerald;
  const action = opts.action || cfg.action || 'idle';
  const expression = opts.expression || cfg.expression || expressionForAction(action);
  const aura = cfg.aura || 'halo';
  const accessory = cfg.accessory || 'none';
  const skinShade = shade(skin, -18);
  const deepSkin = shade(skin, -34);
  const skinLight = shade(skin, 13);
  const hairStyle = cfg.hairStyle || 'short';

  return `
    <svg viewBox="0 0 240 320" xmlns="http://www.w3.org/2000/svg" class="bitmoji-svg moji-art bm-action-${action}">
      <defs>
        <radialGradient id="${uid}-aura" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stop-color="#D7A94D" stop-opacity="0.38"/>
          <stop offset="48%" stop-color="#19C58F" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#050806" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="${uid}-skin" x1="20%" x2="78%" y1="8%" y2="100%">
          <stop offset="0%" stop-color="${skinLight}"/>
          <stop offset="54%" stop-color="${skin}"/>
          <stop offset="100%" stop-color="${skinShade}"/>
        </linearGradient>
        <linearGradient id="${uid}-outfit" x1="14%" x2="92%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="${tint(outfit.primary, 9)}"/>
          <stop offset="58%" stop-color="${outfit.primary}"/>
          <stop offset="100%" stop-color="${shade(outfit.primary, -18)}"/>
        </linearGradient>
        <linearGradient id="${uid}-gold" x1="0%" x2="100%">
          <stop offset="0%" stop-color="#F2DA9A"/>
          <stop offset="54%" stop-color="#D7A94D"/>
          <stop offset="100%" stop-color="#8B641A"/>
        </linearGradient>
        <filter id="${uid}-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#000000" flood-opacity="0.32"/>
        </filter>
      </defs>

      ${renderAura(aura, uid)}
      <ellipse cx="120" cy="292" rx="58" ry="9" fill="#000" opacity="0.26"/>
      ${renderLegs(gender, skin, outfit)}
      ${renderBody(gender, outfit, uid)}
      ${renderArms(action, gender, skin, outfit, uid)}
      ${renderNeck(gender, uid, skinShade)}
      ${renderHead(gender, uid, skinShade, deepSkin)}
      ${renderHair(hairStyle, gender, hair)}
      ${renderFace(expression, gender, hair, skin, deepSkin, outfit)}
      ${renderAccessory(accessory, gender, outfit, hair, uid)}
      ${renderActionProp(action, outfit, uid)}
      ${cfg.tier === 'kingdom' ? renderCrown(uid) : ''}
    </svg>
  `;
}

function renderAura(aura, uid) {
  if (aura === 'none') return '';
  if (aura === 'fireflies') {
    return `
      <ellipse cx="120" cy="146" rx="92" ry="112" fill="url(#${uid}-aura)" opacity="0.64"/>
      <g class="moji-fireflies">
        <circle class="moji-firefly f1" cx="55" cy="76" r="2.2" fill="#F2DA9A"/>
        <circle class="moji-firefly f2" cx="184" cy="95" r="2.4" fill="#19C58F"/>
        <circle class="moji-firefly f3" cx="48" cy="178" r="1.9" fill="#D7A94D"/>
        <circle class="moji-firefly f4" cx="190" cy="171" r="2" fill="#19C58F"/>
      </g>
    `;
  }
  if (aura === 'anointing') {
    return `
      <ellipse cx="120" cy="150" rx="96" ry="126" fill="url(#${uid}-aura)" opacity="0.72"/>
      <path d="M120 26 C108 45 107 61 120 70 C133 61 132 45 120 26 Z" fill="url(#${uid}-gold)" opacity="0.88"/>
    `;
  }
  return `
    <ellipse cx="120" cy="68" rx="54" ry="12" fill="none" stroke="url(#${uid}-gold)" stroke-width="4.5" opacity="0.88"/>
    <ellipse cx="120" cy="68" rx="68" ry="17" fill="none" stroke="#19C58F" stroke-width="1" opacity="0.26"/>
  `;
}

function renderLegs(gender, skin, outfit) {
  const pant = shade(outfit.primary, -16);
  const shoe = '#050806';
  if (gender === 'masculine') {
    return `
      <g class="moji-legs">
        <path d="M91 224 C98 236 99 257 96 286 L80 286 C77 254 78 234 86 220 Z" fill="${pant}"/>
        <path d="M149 224 C142 236 141 257 144 286 L160 286 C163 254 162 234 154 220 Z" fill="${pant}"/>
        <path d="M78 284 C90 280 101 284 104 291 L76 291 C72 289 73 286 78 284 Z" fill="${shoe}"/>
        <path d="M136 291 C139 284 151 280 163 284 C168 286 168 289 164 291 Z" fill="${shoe}"/>
      </g>
    `;
  }
  return `
    <g class="moji-legs">
      <path d="M91 225 C96 239 97 260 94 286 L80 286 C78 258 79 240 86 224 Z" fill="${skin}"/>
      <path d="M149 225 C144 239 143 260 146 286 L160 286 C162 258 161 240 154 224 Z" fill="${skin}"/>
      <path d="M78 284 C90 280 100 284 103 291 L77 291 C72 289 73 286 78 284 Z" fill="${shoe}"/>
      <path d="M137 291 C140 284 150 280 162 284 C167 286 168 289 163 291 Z" fill="${shoe}"/>
    </g>
  `;
}

function renderBody(gender, outfit, uid) {
  const body = gender === 'masculine'
    ? 'M63 207 C63 171 80 151 103 147 L137 147 C160 151 177 171 177 207 L172 241 C145 247 96 247 68 241 Z'
    : 'M72 207 C70 171 86 154 106 149 L134 149 C154 154 170 171 168 207 C176 222 172 238 166 246 C139 253 101 253 74 246 C68 238 64 222 72 207 Z';
  return `
    <g class="moji-body" filter="url(#${uid}-soft)">
      <path class="moji-body-shape" d="${body}" fill="url(#${uid}-outfit)"/>
      <path d="${body}" fill="none" stroke="${outfit.accent}" stroke-width="1.4" opacity="0.7"/>
      <path d="M92 151 C104 173 128 184 151 153" fill="none" stroke="url(#${uid}-gold)" stroke-width="2.2" opacity="0.82"/>
      <path d="M118 151 C113 184 110 216 112 246" fill="none" stroke="${outfit.accent}" stroke-width="1" opacity="0.28"/>
      <path d="M75 225 C102 236 138 237 166 225" fill="none" stroke="#D7A94D" stroke-width="0.8" opacity="0.36"/>
    </g>
  `;
}

function renderArms(action, gender, skin, outfit, uid) {
  const arm = `url(#${uid}-skin)`;
  const shadow = shade(skin, -30);
  if (action === 'wave') {
    return `
      <g class="moji-arm moji-wave-arm">
        <path d="M73 166 C56 150 45 127 39 101" fill="none" stroke="${arm}" stroke-width="16" stroke-linecap="round"/>
        <path d="M39 101 C31 95 34 82 43 84 C51 86 50 99 43 104" fill="${arm}"/>
      </g>
      <path d="M167 166 C184 191 185 219 177 239" fill="none" stroke="${arm}" stroke-width="16" stroke-linecap="round"/>
    `;
  }
  if (action === 'sip') {
    return `
      <path d="M73 166 C55 190 55 221 64 241" fill="none" stroke="${arm}" stroke-width="16" stroke-linecap="round"/>
      <g class="moji-sip-arm">
        <path d="M166 167 C161 145 145 131 130 126" fill="none" stroke="${arm}" stroke-width="16" stroke-linecap="round"/>
        <circle cx="130" cy="126" r="7.5" fill="${arm}"/>
      </g>
    `;
  }
  if (action === 'pray') {
    return `
      <g class="moji-pray-hands">
        <path d="M75 169 C91 149 106 145 118 162" fill="none" stroke="${arm}" stroke-width="16" stroke-linecap="round"/>
        <path d="M165 169 C149 149 134 145 122 162" fill="none" stroke="${arm}" stroke-width="16" stroke-linecap="round"/>
        <path d="M115 150 C119 166 117 188 112 204" fill="none" stroke="${shadow}" stroke-width="1.2" opacity="0.45"/>
        <path d="M125 150 C121 166 123 188 128 204" fill="none" stroke="${shadow}" stroke-width="1.2" opacity="0.45"/>
      </g>
    `;
  }
  if (action === 'read') {
    return `
      <path d="M74 168 C84 191 99 203 112 207" fill="none" stroke="${arm}" stroke-width="15" stroke-linecap="round"/>
      <path d="M166 168 C156 191 141 203 128 207" fill="none" stroke="${arm}" stroke-width="15" stroke-linecap="round"/>
    `;
  }
  return `
    <path d="M74 168 C56 195 56 225 65 244" fill="none" stroke="${arm}" stroke-width="16" stroke-linecap="round"/>
    <path d="M166 168 C184 195 184 225 175 244" fill="none" stroke="${arm}" stroke-width="16" stroke-linecap="round"/>
  `;
}

function renderNeck(gender, uid, skinShade) {
  const x = gender === 'masculine' ? 101 : 105;
  const w = gender === 'masculine' ? 38 : 30;
  return `
    <path d="M${x} 134 H${x + w} V160 C${x + w - 8} 166 ${x + 8} 166 ${x} 160 Z" fill="url(#${uid}-skin)"/>
    <path d="M${x} 154 C${x + 9} 160 ${x + w - 9} 160 ${x + w} 154" fill="none" stroke="${skinShade}" stroke-width="1" opacity="0.48"/>
  `;
}

function renderHead(gender, uid, skinShade, deepSkin) {
  const face = gender === 'masculine'
    ? 'M73 91 C72 58 91 39 120 38 C149 39 168 58 167 91 C168 123 151 145 124 151 C95 150 73 126 73 91 Z'
    : 'M78 91 C77 60 94 42 120 41 C146 42 163 60 162 91 C163 123 148 145 123 151 C97 149 78 124 78 91 Z';
  return `
    <g class="moji-head">
      <path d="${face}" fill="url(#${uid}-skin)"/>
      <path d="${face}" fill="none" stroke="${deepSkin}" stroke-width="0.8" opacity="0.28"/>
      <ellipse cx="${gender === 'masculine' ? 72 : 77}" cy="101" rx="6" ry="9" fill="url(#${uid}-skin)" opacity="0.9"/>
      <ellipse cx="${gender === 'masculine' ? 168 : 163}" cy="101" rx="6" ry="9" fill="url(#${uid}-skin)" opacity="0.9"/>
      <path d="M88 119 C102 136 136 136 152 119" fill="none" stroke="${skinShade}" stroke-width="1" opacity="0.24"/>
    </g>
  `;
}

function renderHair(style, gender, hair) {
  if (style === 'shaved') {
    return `<path d="M78 83 C84 52 99 42 120 41 C143 42 158 55 162 83 C145 70 97 69 78 83 Z" fill="${hair}" opacity="0.25"/>`;
  }
  if (style === 'afro') {
    return `
      <g fill="${hair}">
        <circle cx="78" cy="73" r="20"/><circle cx="94" cy="50" r="24"/><circle cx="120" cy="43" r="28"/>
        <circle cx="146" cy="51" r="24"/><circle cx="162" cy="75" r="20"/><circle cx="73" cy="96" r="18"/>
        <circle cx="167" cy="96" r="18"/><path d="M75 88 C80 48 160 48 165 88 C146 72 96 72 75 88 Z"/>
      </g>
    `;
  }
  if (style === 'braids' || style === 'locs') {
    const long = style === 'locs';
    return `
      <path d="M76 84 C83 54 99 40 120 40 C143 40 158 55 164 84 C141 70 99 70 76 84 Z" fill="${hair}"/>
      <g fill="none" stroke="${hair}" stroke-width="${long ? 8 : 6}" stroke-linecap="round">
        <path d="M82 82 C72 113 69 143 72 ${long ? 175 : 154}"/>
        <path d="M96 74 C88 111 87 143 90 ${long ? 181 : 160}"/>
        <path d="M111 70 C106 111 107 144 109 ${long ? 186 : 163}"/>
        <path d="M129 70 C134 111 133 144 131 ${long ? 186 : 163}"/>
        <path d="M144 74 C152 111 153 143 150 ${long ? 181 : 160}"/>
        <path d="M158 82 C168 113 171 143 168 ${long ? 175 : 154}"/>
      </g>
    `;
  }
  if (style === 'twists') {
    return `
      <path d="M77 85 C82 55 99 41 120 40 C143 41 158 56 163 85 C146 73 95 73 77 85 Z" fill="${hair}"/>
      <g fill="${hair}">
        ${[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((n, i) =>
          `<ellipse cx="${120 + n * 9}" cy="${65 - Math.abs(n) * 2}" rx="7" ry="12" transform="rotate(${n * 8} ${120 + n * 9} ${65 - Math.abs(n) * 2})"/>`
        ).join('')}
      </g>
    `;
  }
  return `
    <path d="M76 84 C82 52 99 39 120 39 C144 40 159 55 164 85 C145 70 97 70 76 84 Z" fill="${hair}"/>
    <path d="M80 82 C91 62 106 55 124 55 C140 56 154 64 161 82 C139 72 101 72 80 82 Z" fill="${tint(hair, 14)}" opacity="0.38"/>
  `;
}

function renderFace(expression, gender, hair, skin, deepSkin, outfit) {
  const eye = expression === 'prayer'
    ? `
      <path d="M91 96 C98 101 105 101 112 96" fill="none" stroke="#130C08" stroke-width="2" stroke-linecap="round"/>
      <path d="M128 96 C135 101 142 101 149 96" fill="none" stroke="#130C08" stroke-width="2" stroke-linecap="round"/>
    `
    : `
      <g class="moji-eyes">
        <path d="M90 97 C96 90 106 90 113 97 C106 103 97 103 90 97 Z" fill="#FFF8EA"/>
        <path d="M127 97 C134 90 144 90 150 97 C143 103 134 103 127 97 Z" fill="#FFF8EA"/>
        <circle cx="102" cy="97" r="4.1" fill="#130C08"/><circle cx="138" cy="97" r="4.1" fill="#130C08"/>
        <circle cx="103.5" cy="95.6" r="1.15" fill="#FFF8EA"/><circle cx="139.5" cy="95.6" r="1.15" fill="#FFF8EA"/>
      </g>
    `;
  const lashes = gender === 'feminine' && expression !== 'prayer'
    ? '<path d="M88 96 L84 93 M152 96 L156 93" stroke="#130C08" stroke-width="1.1" stroke-linecap="round" opacity="0.7"/>'
    : '';
  return `
    <g class="moji-face">
      <path d="M88 86 C96 81 106 81 114 86" fill="none" stroke="${hair}" stroke-width="${gender === 'masculine' ? 2.2 : 1.7}" stroke-linecap="round"/>
      <path d="M126 86 C134 81 144 81 152 86" fill="none" stroke="${hair}" stroke-width="${gender === 'masculine' ? 2.2 : 1.7}" stroke-linecap="round"/>
      ${eye}
      ${lashes}
      <path d="M120 103 C117 111 117 117 120 121 C123 117 123 111 120 103" fill="none" stroke="${deepSkin}" stroke-width="1.15" opacity="0.6"/>
      <ellipse cx="120" cy="122.2" rx="2.2" ry="1.15" fill="${deepSkin}" opacity="0.34"/>
      ${renderMouth(expression, gender, skin, outfit)}
      ${gender === 'feminine' ? `<ellipse cx="94" cy="115" rx="6" ry="3" fill="${tint(skin, 15)}" opacity="0.32"/><ellipse cx="146" cy="115" rx="6" ry="3" fill="${tint(skin, 15)}" opacity="0.32"/>` : ''}
      ${expression === 'focused' ? `<path d="M87 89 C98 83 108 84 116 91 M124 91 C132 84 143 83 153 89" fill="none" stroke="${outfit.accent}" stroke-width="1.1" opacity="0.58"/>` : ''}
      ${expression === 'spark' ? `<path d="M165 78 L169 88 L179 92 L169 96 L165 106 L161 96 L151 92 L161 88 Z" fill="#D7A94D" opacity="0.92"/>` : ''}
    </g>
  `;
}

function renderMouth(expression, gender, skin, outfit) {
  if (expression === 'prayer') {
    return `<path d="M112 130 C117 132 123 132 128 130" fill="none" stroke="${shade(skin, -42)}" stroke-width="1.35" stroke-linecap="round" opacity="0.85"/>`;
  }
  if (expression === 'joyful') {
    return `<path d="M107 128 C114 138 126 138 133 128" fill="none" stroke="${shade(skin, -42)}" stroke-width="2.1" stroke-linecap="round"/>`;
  }
  if (expression === 'spark') {
    return `<path d="M108 128 C115 135 125 135 132 128" fill="none" stroke="${outfit.accent}" stroke-width="2" stroke-linecap="round"/>`;
  }
  if (expression === 'focused') {
    return `<path d="M112 130 C117 129 123 129 128 130" fill="none" stroke="${shade(skin, -44)}" stroke-width="1.4" stroke-linecap="round"/>`;
  }
  if (gender === 'feminine') {
    return `
      <path d="M109 129 C114 126 118 128 120 129 C122 128 126 126 131 129 C127 132 113 132 109 129 Z" fill="${shade(skin, -30)}" opacity="0.82"/>
      <path d="M111 130 C116 133 124 133 129 130" fill="none" stroke="#2A140D" stroke-width="0.75" opacity="0.54"/>
    `;
  }
  return `<path d="M111 130 C117 128 123 128 129 130" fill="none" stroke="${shade(skin, -42)}" stroke-width="1.4" stroke-linecap="round"/>`;
}

function renderAccessory(accessory, gender, outfit, hair, uid) {
  if (accessory === 'glasses') {
    return `
      <g fill="none" stroke="url(#${uid}-gold)" stroke-width="2.2" opacity="0.92">
        <rect x="86" y="88" width="31" height="22" rx="9"/>
        <rect x="123" y="88" width="31" height="22" rx="9"/>
        <path d="M117 99 H123"/>
      </g>
    `;
  }
  if (accessory === 'headwrap') {
    return `
      <path d="M75 82 C84 50 101 36 124 38 C146 41 160 57 164 82 C140 70 99 70 75 82 Z" fill="#0F8F6D" stroke="#D7A94D" stroke-width="1.4"/>
      <path d="M111 43 C124 32 139 41 139 55 C127 57 117 52 111 43 Z" fill="url(#${uid}-gold)"/>
    `;
  }
  if (accessory === 'crown') return renderCrown(uid);
  if (accessory === 'hoops') {
    return `
      <circle cx="${gender === 'masculine' ? 70 : 76}" cy="106" r="4" fill="none" stroke="url(#${uid}-gold)" stroke-width="1.7"/>
      <circle cx="${gender === 'masculine' ? 170 : 164}" cy="106" r="4" fill="none" stroke="url(#${uid}-gold)" stroke-width="1.7"/>
    `;
  }
  return `<circle cx="${gender === 'masculine' ? 70 : 76}" cy="106" r="1.7" fill="${outfit.accent}" opacity="0.8"/><circle cx="${gender === 'masculine' ? 170 : 164}" cy="106" r="1.7" fill="${outfit.accent}" opacity="0.8"/>`;
}

function renderCrown(uid) {
  return `<path d="M91 50 L103 61 L119 42 L135 61 L149 50 L145 70 H95 Z" fill="url(#${uid}-gold)" stroke="#050806" stroke-width="1.1"/>`;
}

function renderActionProp(action, outfit, uid) {
  if (action === 'sip') {
    return `
      <g class="moji-tea-cup">
        <rect x="123" y="113" width="22" height="18" rx="5" fill="#050806" stroke="url(#${uid}-gold)" stroke-width="1.5"/>
        <path d="M145 118 C157 120 150 131 143 127" fill="none" stroke="#D7A94D" stroke-width="1.5"/>
        <path d="M128 109 C129 103 126 100 128 95 M136 109 C137 103 134 100 136 95" fill="none" stroke="#F2DA9A" stroke-width="1" opacity="0.7"/>
      </g>
    `;
  }
  if (action === 'read') {
    return `
      <g class="moji-book-prop">
        <path d="M80 198 C96 190 112 194 120 204 V232 C106 221 94 218 80 224 Z" fill="#F2DA9A" stroke="#7A5A18" stroke-width="1"/>
        <path d="M120 204 C128 194 144 190 160 198 V224 C146 218 134 221 120 232 Z" fill="#FFF8EA" stroke="#7A5A18" stroke-width="1"/>
        <path d="M120 204 V232" stroke="#7A5A18" stroke-width="1"/>
        <path d="M90 206 H110 M90 214 H105 M131 206 H151 M134 214 H151" stroke="#7A5A18" stroke-width="0.8" opacity="0.45"/>
      </g>
    `;
  }
  if (action === 'banner') {
    return `
      <g class="moji-banner-ribbon">
        <path d="M45 204 H195 Q202 204 202 211 V235 Q202 242 195 242 H45 Q38 242 38 235 V211 Q38 204 45 204 Z" fill="#050806" stroke="url(#${uid}-gold)" stroke-width="1.4"/>
        <path d="M52 215 H188 M52 229 H160" stroke="${outfit.accent}" stroke-width="1.1" opacity="0.58"/>
      </g>
    `;
  }
  return '';
}

function expressionForAction(action) {
  if (action === 'pray') return 'prayer';
  if (action === 'read') return 'focused';
  if (action === 'wave' || action === 'banner') return 'joyful';
  return 'steady';
}

function shade(hex, pct) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const adj = v => Math.max(0, Math.min(255, Math.round(v + (pct / 100) * 255)));
  return `#${[adj(r), adj(g), adj(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function tint(hex, pct) {
  return shade(hex, Math.abs(pct));
}
