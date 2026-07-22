// encouragement.js — keep the fire burning when answers tarry.
//
// Pulls active prayers + prophecies, infers a theme by keyword matching,
// then suggests a Bible verse + worship song to stand on. Cycles a new
// suggestion each time the dashboard renders so the user gets fresh feed.

import { all } from './store.js';

import { esc } from './util/esc.js';
// ── Scripture bank ────────────────────────────────────────────
// Each theme maps to multiple verses so we can rotate.

export const SCRIPTURES = {
  waiting: [
    { ref: 'Habakkuk 2:3',     text: 'For the vision is yet for an appointed time… though it tarry, wait for it; because it will surely come, it will not tarry.' },
    { ref: 'Psalm 27:14',      text: 'Wait on the LORD: be of good courage, and He shall strengthen thine heart: wait, I say, on the LORD.' },
    { ref: 'Isaiah 40:31',     text: 'They that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles.' },
    { ref: 'Lamentations 3:25', text: 'The LORD is good unto them that wait for him, to the soul that seeketh him.' },
  ],
  faith: [
    { ref: 'Hebrews 11:1',     text: 'Now faith is the substance of things hoped for, the evidence of things not seen.' },
    { ref: 'Mark 11:24',       text: 'Whatsoever things ye desire, when ye pray, believe that ye receive them, and ye shall have them.' },
    { ref: 'Matthew 17:20',    text: 'If ye have faith as a grain of mustard seed… nothing shall be impossible unto you.' },
    { ref: 'Romans 4:18',      text: 'Who against hope believed in hope, that he might become the father of many nations.' },
  ],
  prophecy: [
    { ref: '1 Timothy 1:18',   text: 'This charge I commit unto thee… according to the prophecies which went before on thee, that thou by them mightest war a good warfare.' },
    { ref: 'Habakkuk 2:3',     text: 'For the vision is yet for an appointed time… though it tarry, wait for it; because it will surely come.' },
    { ref: 'Numbers 23:19',    text: 'God is not a man, that he should lie; neither the son of man, that he should repent: hath he said, and shall he not do it?' },
    { ref: '2 Peter 1:19',     text: 'We have also a more sure word of prophecy; whereunto ye do well that ye take heed.' },
  ],
  breakthrough: [
    { ref: 'Isaiah 43:19',     text: 'Behold, I will do a new thing; now it shall spring forth; shall ye not know it?' },
    { ref: 'Micah 2:13',       text: 'The breaker is come up before them: they have broken up, and have passed through the gate.' },
    { ref: '2 Samuel 5:20',    text: 'The LORD hath broken forth upon mine enemies before me, as the breach of waters.' },
    { ref: 'Psalm 18:29',      text: 'By thee I have run through a troop; and by my God have I leaped over a wall.' },
  ],
  healing: [
    { ref: 'Isaiah 53:5',      text: '… with his stripes we are healed.' },
    { ref: 'Jeremiah 30:17',   text: 'I will restore health unto thee, and I will heal thee of thy wounds, saith the LORD.' },
    { ref: 'Psalm 103:2-3',    text: 'Bless the LORD, O my soul… who forgiveth all thine iniquities; who healeth all thy diseases.' },
    { ref: 'Matthew 8:17',     text: 'Himself took our infirmities, and bare our sicknesses.' },
  ],
  provision: [
    { ref: 'Philippians 4:19', text: 'My God shall supply all your need according to his riches in glory by Christ Jesus.' },
    { ref: 'Psalm 23:1',       text: 'The LORD is my shepherd; I shall not want.' },
    { ref: 'Matthew 6:33',     text: 'Seek ye first the kingdom of God… and all these things shall be added unto you.' },
    { ref: 'Malachi 3:10',     text: 'Bring ye all the tithes into the storehouse… prove me now herewith… if I will not open you the windows of heaven.' },
  ],
  family: [
    { ref: 'Acts 16:31',       text: 'Believe on the Lord Jesus Christ, and thou shalt be saved, and thy house.' },
    { ref: 'Isaiah 49:25',     text: 'I will contend with him that contendeth with thee, and I will save thy children.' },
    { ref: 'Joshua 24:15',     text: 'As for me and my house, we will serve the LORD.' },
    { ref: 'Proverbs 11:21',   text: '… the seed of the righteous shall be delivered.' },
  ],
  marriage: [
    { ref: 'Proverbs 18:22',   text: 'Whoso findeth a wife findeth a good thing, and obtaineth favour of the LORD.' },
    { ref: 'Genesis 2:18',     text: 'It is not good that the man should be alone; I will make him an help meet for him.' },
    { ref: 'Ecclesiastes 4:9', text: 'Two are better than one; because they have a good reward for their labour.' },
    { ref: 'Song of Songs 8:7', text: 'Many waters cannot quench love, neither can the floods drown it.' },
  ],
  business: [
    { ref: 'Deuteronomy 8:18', text: 'Remember the LORD thy God: for it is he that giveth thee power to get wealth.' },
    { ref: 'Proverbs 16:3',    text: 'Commit thy works unto the LORD, and thy thoughts shall be established.' },
    { ref: 'Psalm 90:17',      text: 'Establish thou the work of our hands upon us; yea, the work of our hands establish thou it.' },
    { ref: 'Ecclesiastes 9:10', text: 'Whatsoever thy hand findeth to do, do it with thy might.' },
  ],
  deliverance: [
    { ref: 'Psalm 34:17',      text: 'The righteous cry, and the LORD heareth, and delivereth them out of all their troubles.' },
    { ref: '2 Corinthians 1:10', text: 'Who delivered us… and doth deliver: in whom we trust that he will yet deliver us.' },
    { ref: 'Psalm 18:2',       text: 'The LORD is my rock, and my fortress, and my deliverer.' },
    { ref: 'Isaiah 54:17',     text: 'No weapon that is formed against thee shall prosper.' },
  ],
  hope: [
    { ref: 'Jeremiah 29:11',   text: 'I know the thoughts that I think toward you… thoughts of peace, and not of evil, to give you an expected end.' },
    { ref: 'Romans 15:13',     text: 'Now the God of hope fill you with all joy and peace in believing.' },
    { ref: 'Psalm 42:11',      text: 'Why art thou cast down, O my soul?… hope thou in God: for I shall yet praise him.' },
    { ref: 'Hebrews 10:23',    text: 'Let us hold fast the profession of our faith without wavering; (for he is faithful that promised;)' },
  ],
  perseverance: [
    { ref: 'Galatians 6:9',    text: 'Let us not be weary in well doing: for in due season we shall reap, if we faint not.' },
    { ref: 'James 1:12',       text: 'Blessed is the man that endureth temptation: for when he is tried, he shall receive the crown of life.' },
    { ref: 'Hebrews 12:1',     text: 'Let us run with patience the race that is set before us.' },
    { ref: '2 Chronicles 15:7', text: 'Be ye strong therefore, and let not your hands be weak: for your work shall be rewarded.' },
  ],
  fear: [
    { ref: '2 Timothy 1:7',    text: 'God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.' },
    { ref: 'Isaiah 41:10',     text: 'Fear thou not; for I am with thee… I will strengthen thee; yea, I will help thee.' },
    { ref: 'Psalm 27:1',       text: 'The LORD is my light and my salvation; whom shall I fear?' },
    { ref: 'Joshua 1:9',       text: 'Be strong and of a good courage; be not afraid… for the LORD thy God is with thee whithersoever thou goest.' },
  ],
};

// ── Song bank — worship & gospel suggestions, paired to themes ──

export const SONGS = {
  waiting: [
    { title: 'Wait On You',      artist: 'Elevation Worship, Maverick City' },
    { title: 'In The Waiting',   artist: 'Steffany Gretzinger' },
  ],
  faith: [
    { title: 'I Believe',        artist: 'Phil Wickham' },
    { title: 'Same God',         artist: 'Elevation Worship' },
  ],
  prophecy: [
    { title: 'Promises',         artist: 'Maverick City' },
    { title: 'Word of God Speak', artist: 'MercyMe' },
  ],
  breakthrough: [
    { title: 'Way Maker',        artist: 'Sinach' },
    { title: 'See A Victory',    artist: 'Elevation Worship' },
    { title: 'I See A Victory',  artist: 'Yolanda Adams' },
  ],
  healing: [
    { title: 'Healer',           artist: 'Hillsong' },
    { title: 'There is Power',   artist: 'Lincoln Brewster' },
  ],
  provision: [
    { title: 'Jehovah Jireh',    artist: 'Don Moen' },
    { title: 'God Provides',     artist: 'Tamela Mann' },
  ],
  family: [
    { title: 'Goodness of God',  artist: 'CeCe Winans' },
    { title: 'Household',        artist: 'Nathaniel Bassey' },
  ],
  marriage: [
    { title: 'How He Loves',     artist: 'David Crowder Band' },
    { title: 'Cornerstone',      artist: 'Hillsong' },
  ],
  business: [
    { title: 'Greater',          artist: 'MercyMe' },
    { title: 'Wonderful Counselor', artist: 'Hillsong' },
  ],
  deliverance: [
    { title: 'No Longer Slaves', artist: 'Bethel Music' },
    { title: 'Break Every Chain',artist: 'Tasha Cobbs' },
  ],
  hope: [
    { title: 'Believe For It',   artist: 'CeCe Winans' },
    { title: 'King of My Heart', artist: 'Bethel Music' },
  ],
  perseverance: [
    { title: 'Hills and Valleys',artist: 'Tauren Wells' },
    { title: 'Still',            artist: 'Hillsong' },
  ],
  fear: [
    { title: 'No Longer Slaves', artist: 'Bethel Music' },
    { title: 'Surrounded',       artist: 'Michael W Smith' },
  ],
};

// ── Theme inference ──────────────────────────────────────────

const THEME_KEYWORDS = {
  healing:      /\b(heal|healing|sick|illness|cancer|pain|disease|recover|whole)\b/i,
  provision:    /\b(money|provision|provide|supply|debt|salary|rent|fund|finance|capital|breakthrough financial)\b/i,
  family:       /\b(family|son|daughter|child|children|sibling|parents?|mother|father|household|relatives?)\b/i,
  marriage:     /\b(marriage|spouse|husband|wife|partner|engagement|wedding|courtship|union)\b/i,
  business:     /\b(business|venture|company|startup|enterprise|career|job|work|launch|deal|client)\b/i,
  deliverance:  /\b(deliver|deliverance|bondage|freedom|enemies?|attack|warfare|chains?|stronghold)\b/i,
  breakthrough: /\b(breakthrough|open door|new chapter|next level|elevation)\b/i,
  prophecy:     /\b(prophecy|prophet|word|vision|dream|seer)\b/i,
  fear:         /\b(fear|anxiety|worry|afraid|panic|nervous)\b/i,
  perseverance: /\b(persevere|endure|tired|weary|burnout|exhausted|keep going)\b/i,
};

export function inferTheme(text) {
  const s = String(text || '');
  for (const [theme, re] of Object.entries(THEME_KEYWORDS)) {
    if (re.test(s)) return theme;
  }
  return 'waiting';  // default: encourage waiting on God
}

function pick(arr) {
  if (!arr || arr.length === 0) return null;
  // Daily-rotating seed so the suggestion changes through the day but feels consistent
  const seed = new Date().getHours() + new Date().getDate();
  return arr[seed % arr.length];
}

// ── Public: build the dashboard encouragement card ───────────

export async function buildEncouragements({ limit = 3 } = {}) {
  const [prayers, prophecies] = await Promise.all([
    all('prayers').catch(() => []),
    all('prophecies').catch(() => []),
  ]);

  const activePrayers = prayers.filter(p => !p.answer || p.answer === 'pending');
  const activeProphecies = prophecies.filter(p => !p.status || p.status === 'active' || p.status === 'partially-fulfilled');

  // Build a unified pool. Newer & higher-intensity items rank first.
  const pool = [
    ...activeProphecies.map(p => ({
      kind: 'prophecy',
      id: p.id,
      subject: p.word || '',
      hint:    p.speaker ? `from ${p.speaker}` : '',
      themeHint: p.theme,
      intensity: 4,
      ageMs: Date.now() - new Date(p.dateReceived || p.createdAt || 0).getTime(),
    })),
    ...activePrayers.map(p => ({
      kind: 'prayer',
      id: p.id,
      subject: p.subject || '',
      hint:    p.type || 'supplication',
      themeHint: '',
      intensity: p.intensity || 3,
      ageMs: Date.now() - new Date(p.startedOn || p.createdAt || 0).getTime(),
    })),
  ];

  if (pool.length === 0) return [];

  // Rank: higher intensity first, then older (the ones you might be tempted to give up on)
  pool.sort((a, b) => (b.intensity - a.intensity) || (b.ageMs - a.ageMs));

  const seedOffset = new Date().getHours();  // rotate which items surface as hours pass
  const rotated = [...pool.slice(seedOffset % pool.length), ...pool.slice(0, seedOffset % pool.length)];

  return rotated.slice(0, limit).map(item => {
    const theme = item.themeHint && SCRIPTURES[item.themeHint] ? item.themeHint : inferTheme(item.subject);
    const verse = pick(SCRIPTURES[theme]) || pick(SCRIPTURES.waiting);
    const song  = pick(SONGS[theme])      || pick(SONGS.waiting);
    return { ...item, theme, verse, song };
  });
}

// ── Render the card HTML for the dashboard ─────────────

export async function renderEncouragementCard() {
  const items = await buildEncouragements({ limit: 3 });
  if (items.length === 0) return '';

  const cards = items.map(it => `
    <div class="enc-card" data-store="${it.kind === 'prayer' ? 'prayers' : 'prophecies'}" data-id="${esc(it.id)}">
      <div class="enc-card-head">
        <span class="enc-kind">${it.kind === 'prayer' ? '✝ standing in prayer' : '◆ word received'}</span>
        <span class="enc-theme">${esc(it.theme)}</span>
      </div>
      <div class="enc-subject">${esc(snip(it.subject, 140))}</div>
      ${it.hint ? `<div class="meta">${esc(it.hint)}</div>` : ''}
      <blockquote class="enc-verse">
        <span class="enc-verse-text">"${esc(it.verse.text)}"</span>
        <span class="enc-verse-ref">— ${esc(it.verse.ref)}</span>
      </blockquote>
      ${it.song ? `<div class="enc-song">♪ <strong>${esc(it.song.title)}</strong> · ${esc(it.song.artist)}</div>` : ''}
    </div>
  `).join('');

  return `
    <section class="dash-section">
      <div class="label">keep the fire burning · scripture for what you're standing on</div>
      <div class="enc-grid">${cards}</div>
    </section>
  `;
}

function snip(s, n) { const str = String(s || ''); return str.length > n ? str.slice(0, n) + '…' : str; }
