// Nes — the chat bot inside Miracle. Deterministic v0 parser.
// Phase 4 swaps the resolver for Claude (via Claude Desktop bridge).
// Holy Spirit is never an A.I. — Nes is a tool, nothing more.

import { put, get, all, ulid } from './store.js';
import { VENTURES, FAST_TYPES, BIBLE_BOOKS, SR_INTERVALS_DAYS, fuzzyMatch } from './domain.js';
import { randomVerse } from './scripture.js';
import { connect as bridgeConnect, exportAll as bridgeExport, checkInbox as bridgeInbox, applyInboxFile as bridgeApply, isConnected as bridgeIsConnected, listOutbox as bridgeOutbox } from './bridge.js';
import { icon } from './icons.js';
import { streamChat, loadHistory, saveHistory } from './nes-client.js';
import { micButton, attachDictation, VOICE_SUPPORTED } from './voice.js';

import { esc } from './util/esc.js';
import { formatList } from './util/list.js';
let root, log, input, sendBtn;

export function mountMiracle(el) {
  root = el;
  root.innerHTML = `
    <div class="miracle-head">
      <span class="dot emerald pulse"></span>
      <span>nes</span>
      <span class="miracle-version">v0 · holy spirit ≠ a.i.</span>
    </div>
    <div class="miracle-log" id="m-log"></div>
    <div class="miracle-input">
      <input type="text" id="m-input" placeholder="/idea · /task · /pray · /verse · /testimony · /music · /person · /help" autocomplete="off" spellcheck="false">
      <span id="m-mic-host"></span>
      <button class="m-send" id="m-send" type="button" title="send" aria-label="send">${icon('send', { size: 14 })}</button>
    </div>
  `;
  log     = root.querySelector('#m-log');
  input   = root.querySelector('#m-input');
  sendBtn = root.querySelector('#m-send');

  // Greet with user's first name if known
  import('./user.js').then(({ loadUser, firstName }) => loadUser().then(u => greet(u ? firstName(u) : null)));

  const submit = async () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    await handle(text);
  };

  input.addEventListener('keydown', async e => {
    if (e.key === 'Enter') { e.preventDefault(); await submit(); }
    if (e.key === 'Escape') toggleMiracle(false);
  });

  sendBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await submit();
    input.focus();
  });

  // Mic dictation for the Nes input — speak instead of type
  if (VOICE_SUPPORTED) {
    const mic = micButton({ label: 'dictate to nes', size: 30 });
    root.querySelector('#m-mic-host').appendChild(mic);
    attachDictation(mic, input);
  }
}
export function toggleMiracle(force) {
  const open = root.classList.contains('is-open');
  const next = typeof force === 'boolean' ? force : !open;
  root.classList.toggle('is-open', next);
  if (next) {
    setTimeout(() => input.focus(), 30);
    document.addEventListener('pointerdown', outsideHandler, { capture: true });
  } else {
    document.removeEventListener('pointerdown', outsideHandler, { capture: true });
  }
}

function outsideHandler(e) {
  if (!root) return;
  // Don't close if click was inside Nes panel
  if (root.contains(e.target)) return;
  // Don't close if the click was on the toggle button or its child
  if (e.target.closest('#tb-miracle')) return;
  toggleMiracle(false);
}

function greet(firstName) {
  const v = randomVerse();
  const who = firstName ? `, ${firstName}` : '';
  push('bot', `i am here${who}. <code>/help</code> for commands. <span class="scripture">${esc(v.ref)} · ${esc(v.text)}</span>`);
}

function withScripture(html, customVerse) {
  const v = customVerse || randomVerse();
  return `${html} <span class="scripture">${esc(v.ref)} · ${esc(v.text)}</span>`;
}

function push(who, html) {
  const turn = document.createElement('div');
  turn.className = `miracle-turn ${who}`;
  turn.innerHTML = `<span class="who">${who === 'you' ? 'you' : '✦ nes'}</span>${html}`;
  log.appendChild(turn);
  log.scrollTop = log.scrollHeight;
}

async function handle(text) {
  push('you', esc(text));
  const parsed = parse(text);

  // Slash command → deterministic fast path (no Claude call, no cost)
  if (parsed) {
    try { push('bot', await write(parsed)); }
    catch (err) { push('bot', `error · ${esc(err.message)}`); }
    return;
  }

  // Free-form text → stream to Nes agent
  await streamToNes(text);
}

async function streamToNes(text) {
  // Render an empty bot bubble we'll fill as deltas arrive
  const turn = document.createElement('div');
  turn.className = 'miracle-turn bot is-streaming';
  turn.innerHTML = `<span class="who">✦ nes</span><span class="m-stream-body"></span><span class="m-tool-strip"></span>`;
  log.appendChild(turn);
  const body  = turn.querySelector('.m-stream-body');
  const strip = turn.querySelector('.m-tool-strip');
  log.scrollTop = log.scrollHeight;

  const history = loadHistory();
  try {
    const final = await streamChat(text, {
      history,
      onDelta: (chunk) => {
        body.textContent += chunk;
        log.scrollTop = log.scrollHeight;
      },
      onToolCall: ({ name }) => {
        const chip = document.createElement('span');
        chip.className = 'm-tool-chip is-running';
        chip.dataset.tool = name;
        chip.textContent = `→ ${name}…`;
        strip.appendChild(chip);
        log.scrollTop = log.scrollHeight;
      },
      onToolResult: ({ name, result }) => {
        const chip = [...strip.querySelectorAll('.m-tool-chip.is-running')].reverse().find(c => c.dataset.tool === name);
        if (chip) {
          chip.classList.remove('is-running');
          chip.classList.add(result?.error ? 'is-error' : 'is-done');
          if (result?.error) chip.textContent = `✕ ${name}`;
          else if (result?.id) chip.textContent = `✓ ${name} · ${String(result.id).slice(-6)}`;
          else if (Array.isArray(result?.results)) chip.textContent = `✓ ${name} · ${result.results.length}`;
          else chip.textContent = `✓ ${name}`;
        }
      },
      onError: ({ message }) => {
        body.textContent = body.textContent || '';
        const errEl = document.createElement('span');
        errEl.className = 'meta is-error';
        errEl.textContent = ` · error: ${message}`;
        body.appendChild(errEl);
      },
    });

    turn.classList.remove('is-streaming');

    // Save to session history so multi-turn context works
    history.push({ role: 'user', content: text });
    history.push({ role: 'assistant', content: final });
    saveHistory(history);

    // Notify the rest of the app that data may have changed (tool calls write to MySQL,
    // but the local IDB cache may be stale). Trigger a soft refresh of dashboard etc.
    window.dispatchEvent(new CustomEvent('nes:turn-complete'));
  } catch (err) {
    turn.classList.remove('is-streaming');
    body.textContent = body.textContent || '';
    const errEl = document.createElement('div');
    errEl.className = 'meta';
    errEl.style.color = 'var(--ruby)';
    errEl.textContent = `nes · ${err.message}`;
    turn.appendChild(errEl);
  }
}

// --- parser ---

function parse(text) {
  if (text === '/help')          return { kind: 'help' };
  if (text.startsWith('/idea ')) return { kind: 'idea',  body: text.slice(6).trim() };
  if (text.startsWith('/today ')) return { kind: 'today', body: text.slice(7).trim() };
  if (text.startsWith('/task '))    return parseTask(text.slice(6).trim());
  if (text.startsWith('/plan '))    return parsePlan(text.slice(6).trim());
  if (text.startsWith('/project ')) return parseProject(text.slice(9).trim());
  if (text.startsWith('/event '))   return parseEvent(text.slice(7).trim());
  if (text.startsWith('/spend '))   return parseTx(text.slice(7).trim(), 'out');
  if (text.startsWith('/income '))  return parseTx(text.slice(8).trim(), 'in');
  if (text.startsWith('/pray '))    return parsePrayer(text.slice(6).trim());
  if (text === '/fast end' || text.startsWith('/fast end '))     return { kind: 'fast-end', reflection: text.slice(9).trim() };
  if (text.startsWith('/fast start ')) return parseFastStart(text.slice(12).trim());
  if (text.startsWith('/verse '))   return parseVerse(text.slice(7).trim());
  if (text.startsWith('/dream '))   return parseDream(text.slice(7).trim());
  if (text.startsWith('/meal '))    return parseMeal(text.slice(6).trim());
  if (text.startsWith('/testimony ')) return { kind: 'testimony', body: text.slice(11).trim() };
  if (text.startsWith('/music '))   return parseMusic(text.slice(7).trim());
  if (text.startsWith('/person '))  return parsePerson(text.slice(8).trim());
  if (text.startsWith('/book '))    return parseBook(text.slice(6).trim());
  if (text.startsWith('/note '))    return parseNote(text.slice(6).trim());
  if (text === '/quiz' || text === '/quiz next') return { kind: 'quiz-next' };
  if (text.startsWith('/quiz from ')) return { kind: 'quiz-prompt', source: text.slice(11).trim() };
  if (text.startsWith('/research ')) return { kind: 'research-prompt', target: text.slice(10).trim() };
  if (text === '/sync connect') return { kind: 'sync', op: 'connect' };
  if (text === '/sync export')  return { kind: 'sync', op: 'export' };
  if (text === '/sync inbox')   return { kind: 'sync', op: 'inbox' };
  if (text === '/sync outbox')  return { kind: 'sync', op: 'outbox' };
  if (text.startsWith('/sync apply ')) return { kind: 'sync', op: 'apply', name: text.slice(12).trim() };
  if (text.startsWith('/find ')) return { kind: 'find', q: text.slice(6).trim() };
  if (text === '/fti')           return { kind: 'fti' };
  if (text === '/export json')   return { kind: 'export-json' };
  if (text.startsWith('/ask '))  return { kind: 'ask', prompt: text.slice(5).trim() };
  if (text.startsWith('/draft ')) return { kind: 'draft', prompt: text.slice(7).trim() };
  if (text.startsWith('/blog seed ')) return { kind: 'blog-seed', body: text.slice(11).trim() };
  if (text.startsWith('/blog draft ')) return { kind: 'blog-draft', hint: text.slice(12).trim() };
  if (text.startsWith('/blog publish-static ')) return { kind: 'blog-publish-static', hint: text.slice(21).trim() };
  if (text === '/voice train' || text.startsWith('/voice train ')) return { kind: 'voice-train', hint: text.slice(12).trim() };
  if (text.startsWith('/voice active ')) return { kind: 'voice-active', name: text.slice(14).trim() };
  if (text === '/voice list') return { kind: 'voice-list' };
  return null;
}

function parseMusic(body) {
  const q = body.match(/^"([^"]+)"\s*(?:by\s+([^·]+))?(?:·\s*(.+))?$/);
  if (q) return { kind: 'music', title: q[1].trim(), artist: (q[2] || '').trim(), heard: (q[3] || '').trim() };
  return { kind: 'music', title: body, artist: '', heard: '' };
}

function parsePerson(body) {
  const parts = body.split(' · ');
  return { kind: 'person', name: parts[0].trim(), note: (parts[1] || '').trim() };
}

function parseBook(body) {
  let status = 'wishlist';
  const statusMatch = body.match(/^(reading|finished|paused|wishlist)\s+/i);
  if (statusMatch) { status = statusMatch[1].toLowerCase(); body = body.slice(statusMatch[0].length).trim(); }
  const q = body.match(/^"([^"]+)"\s*(?:by\s+(.+))?$/i);
  if (q) return { kind: 'book', title: q[1].trim(), author: (q[2] || '').trim(), status };
  const byIdx = body.toLowerCase().indexOf(' by ');
  if (byIdx > 0) return { kind: 'book', title: body.slice(0, byIdx).trim(), author: body.slice(byIdx + 4).trim(), status };
  return { kind: 'book', title: body, author: '', status };
}

function parseNote(body) {
  const m = body.match(/^(\S+)\s+(.+)$/s);
  if (!m) return { kind: 'note', error: 'usage: <code>/note current freeform</code> or <code>/note 049B7R freeform</code>' };
  return { kind: 'note', target: m[1], text: m[2] };
}

function parseDream(body) {
  let type = 'nightDream';
  const types = { vision: 'vision', prophetic: 'prophetic', aspirational: 'aspirational', night: 'nightDream' };
  for (const [k, v] of Object.entries(types)) {
    const re = new RegExp(`^${k}\\b`, 'i');
    if (re.test(body)) { type = v; body = body.replace(re, '').trim(); break; }
  }
  const symMatch = body.match(/symbols:\s*([^\.\n]+)/i);
  let symbols = [];
  if (symMatch) { symbols = symMatch[1].split(',').map(s => s.trim()).filter(Boolean); body = body.replace(symMatch[0], '').trim(); }
  return { kind: 'dream', body, type, symbols, title: body.split(/[.\n]/)[0].slice(0, 60) };
}

function parseMeal(body) {
  const slots = ['breakfast','midmorning','lunch','teatime','dinner','latenight'];
  let slot = inferSlot();
  for (const s of slots) {
    if (body.toLowerCase().startsWith(s + ' ') || body.toLowerCase() === s) {
      slot = s; body = body.slice(s.length).trim(); break;
    }
  }
  const costMatch = body.match(/GHS\s*([\d,]+(?:\.\d+)?)/i);
  let costGhs = 0;
  if (costMatch) { costGhs = Number(costMatch[1].replace(/,/g, '')); body = body.replace(costMatch[0], '').trim(); }
  const sourceMatch = body.match(/@(home|cafeteria|restaurant|street|delivery)/i);
  let source = costGhs > 0 ? 'restaurant' : 'home';
  if (sourceMatch) { source = sourceMatch[1].toLowerCase(); body = body.replace(sourceMatch[0], '').trim(); }
  const items = body.split(/,\s*|\s\+\s|\s&\s/).map(s => s.trim()).filter(Boolean);
  return {
    kind: 'meal',
    date: new Date().toISOString().slice(0, 10),
    slot, costGhs, source,
    actualItems: items,
    homeCooked: source === 'home' ? 'yes' : 'no',
  };
}
function quizPrompt(source) {
  // source like "bible:romans" or "books:049B7R" or "book:current"
  const [kind, hint] = source.split(':');
  const intervals = SR_INTERVALS_DAYS.join(', ');
  const md = `### Quiz generation prompt (paste into Claude Desktop)

Read \`state/${kind === 'bible' ? 'bible' : 'books'}.json\` and generate 8 quiz
questions for entries matching "${hint || 'all'}".

- Mix question types: 4 multiple-choice (mc), 2 short-answer (short), 2 true-false (tf)
- Cover comprehension AND application
- Each question MUST include: question, type, choices (mc only, 4 options),
  answer, sourceStore, sourceId, sourceLabel (e.g. "Romans 8" or "Atomic Habits ch.4")
- Set level: 0, status: "due", nextDueAt: now

Write the result to \`inbox/{ts}-quiz-batch.json\` as:

\`\`\`json
{
  "kind": "quiz-batch",
  "generatedBy": "claude-desktop",
  "generatedAt": "<ISO>",
  "ops": [
    { "op": "create", "store": "quizzes", "value": { ... } }
  ]
}
\`\`\`

Then in Hobonichi run \`/sync inbox\` then \`/sync apply <filename>\`.`;
  return `<pre style="white-space:pre-wrap;line-height:1.5;font-size:10px;color:var(--ink-1)">${esc(md)}</pre>`;
}

function blogDraftPrompt(blog) {
  const md = `### Blog draft prompt (paste into Claude Desktop with this bridge folder)

Read \`state/blogs.json\` for entry id \`${blog.id}\` (seed: "${(blog.seedText || '').slice(0, 80)}…").
Read \`state/voiceProfiles.json\` for the profile with active:"yes" — use it for tone.
Read \`state/ideas.json\`, \`state/dreams.json\`, \`state/bible.json\` for any
referenced ideas, dreams, or scripture that should weave in.

Generate:
1. \`title\` — a short, sharp title (not the seed)
2. \`hook\` — first 1-2 sentences that work standalone
3. \`longForm\` — full essay in markdown. 600-1200 words. Adwoa's voice.
4. \`topics\` — 3-5 themes, comma-separated
5. \`cta\` — one sentence inviting engagement
6. \`scriptureRefs\` — if any verses ground it, list them
7. \`variants\` — generate 5: linkedin (3000 char max), x (a thread of 4-7 tweets, 280 each, joined by \\n---\\n), instagram (2200 char max, image-friendly), facebook, threads
   - Each variant: { id, platform, body, hashtags, status: "draft" }
   - id is a 6-char ULID-style string

Write to \`inbox/{ts}-blog-draft.json\`:

\`\`\`json
{
  "kind": "blog-draft",
  "generatedBy": "claude-desktop",
  "generatedAt": "<ISO>",
  "ops": [{
    "op": "update",
    "store": "blogs",
    "value": {
      "id": "${blog.id}",
      "title": "...",
      "hook": "...",
      "longForm": "...",
      "topics": "...",
      "cta": "...",
      "scriptureRefs": "...",
      "status": "review",
      "variants": [...]
    }
  }]
}
\`\`\`

Then in Hobonichi: \`/sync apply <filename>\``;
  return `<pre style="white-space:pre-wrap;line-height:1.5;font-size:10px;color:var(--ink-1)">${esc(md)}</pre>`;
}

function voiceTrainPrompt(hint) {
  const md = `### Voice training prompt (paste into Claude Desktop with this bridge folder)

Read these sample sources for Adwoa's authentic voice:
- \`state/daily.json\` — recent daily-page freeform entries (most authentic)
- \`state/blogs.json\` — any longForm fields from prior posts
- \`state/ideas.json\` — body fields
- \`state/bible.json\` — observation + interpretation + application fields
${hint ? `- Focus on samples tagged or related to: ${hint}` : ''}

Extract a structured voice profile by reading 15-25 substantial samples.

Output to \`inbox/{ts}-voice-profile.json\`:

\`\`\`json
{
  "kind": "voice-profile",
  "ops": [{
    "op": "create",
    "store": "voiceProfiles",
    "value": {
      "name": "personal",
      "active": "yes",
      "tone": "operational, warm-formal, scripture-grounded, ...",
      "formality": "medium-high",
      "sentencePat": "short declaratives + occasional long structured listings",
      "vocabPrefer": "operational\\ninfrastructure\\ndiscipline\\nseason\\nbacklog\\n...",
      "vocabAvoid": "literally\\namazing\\ngame-changer\\nleverage as verb\\n...",
      "ghanaPhrases": "(only opt-in; e.g. 'small small', 'ɛyɛ')",
      "pacing": "front-loads the thesis, evidence after",
      "scripture": "weaves in without preaching",
      "audienceTilt": "professional peers, venture investors, christian leaders"
    }
  }]
}
\`\`\`

Then \`/sync apply <filename>\`. Set active with \`/voice active personal\`.`;
  return `<pre style="white-space:pre-wrap;line-height:1.5;font-size:10px;color:var(--ink-1)">${esc(md)}</pre>`;
}

function researchPrompt(target) {
  const md = `### Book research prompt (paste into Claude Desktop)

Use web search to research "${target}" — author, themes, key ideas, structure,
notable quotes. Then write to \`inbox/{ts}-book-research.json\`:

\`\`\`json
{
  "kind": "book-research",
  "ops": [{
    "op": "create",
    "store": "books",
    "value": {
      "title": "...",
      "author": "...",
      "format": "book",
      "status": "wishlist",
      "summary": "...",
      "keyIdeas": "...\\n...",
      "themes": "...",
      "aiResearched": "yes",
      "source": "..."
    }
  }]
}
\`\`\`

Then \`/sync apply <filename>\` in Hobonichi.`;
  return `<pre style="white-space:pre-wrap;line-height:1.5;font-size:10px;color:var(--ink-1)">${esc(md)}</pre>`;
}

function inferSlot() {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 13) return 'lunch';
  if (h < 16) return 'teatime';
  if (h < 21) return 'dinner';
  return 'latenight';
}

function parseTx(body, direction) {
  const amountMatch = body.match(/GHS\s*([\d,]+(?:\.\d+)?)/i);
  if (!amountMatch) return { kind: 'tx', error: 'need amount. <code>/spend GHS 450 fuel #transport @AGL</code>' };
  const amount = Number(amountMatch[1].replace(/,/g, ''));

  const catMatch = body.match(/#([a-z0-9-]+)/i);
  const category = catMatch ? catMatch[1].toLowerCase() : 'misc';

  const ventMatch = body.match(/@([A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z][A-Za-z0-9-]*)?)/);
  let venture = 'Personal';
  if (ventMatch) {
    const sorted = [...VENTURES].sort((a, b) => b.length - a.length);
    const lower = ventMatch[1].toLowerCase();
    const found = sorted.find(v => fuzzyMatch(v, lower));
    if (found) venture = found;
  }

  const tithe = /!tithe/i.test(body) || category === 'tithe';

  const rest = body
    .replace(/GHS\s*[\d,]+(?:\.\d+)?/i, '')
    .replace(/#[a-z0-9-]+/i, '')
    .replace(/@[A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z][A-Za-z0-9-]*)?/, '')
    .replace(/!tithe/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  const payee = rest.split(/\s+/)[0] || '(unknown)';
  const memo  = rest;

  return {
    kind: 'tx', direction, amount, category, venture, tithe,
    payee, memo,
    date: new Date().toISOString().slice(0, 10),
  };
}

function parsePrayer(body) {
  const intMatch = body.match(/!([1-5])/);
  const intensity = intMatch ? Number(intMatch[1]) : 3;
  body = body.replace(/!([1-5])/, '').trim();

  let type = 'supplication';
  if (/^thanksgiving\b/i.test(body))      { type = 'thanksgiving'; body = body.replace(/^thanksgiving\b/i, '').trim(); }
  else if (/^confession\b/i.test(body))   { type = 'confession';   body = body.replace(/^confession\b/i, '').trim(); }
  else if (/^warfare\b/i.test(body))      { type = 'warfare';      body = body.replace(/^warfare\b/i, '').trim(); }
  else if (/^intercession\b/i.test(body)) { type = 'intercession'; body = body.replace(/^intercession\b/i, '').trim(); }
  else if (/^for\b/i.test(body))          { body = body.replace(/^for\s+/i, '').trim(); }
  else if (/^about\b/i.test(body))        { body = body.replace(/^about\s+/i, '').trim(); }

  const linkMatch = body.match(/→(plan|project|dream|idea):(\S+)/i);
  let linkHint = null;
  if (linkMatch) { linkHint = { kind: linkMatch[1].toLowerCase(), hint: linkMatch[2] }; body = body.replace(linkMatch[0], '').trim(); }

  return { kind: 'prayer', subject: body, type, intensity, linkHint };
}

function parseFastStart(body) {
  let type = 'water';
  for (const t of FAST_TYPES) {
    if (body.toLowerCase().startsWith(t.toLowerCase() + ' ') || body.toLowerCase() === t.toLowerCase()) {
      type = t;
      body = body.slice(t.length).trim();
      break;
    }
  }
  body = body.replace(/^for\s+/i, '').trim();
  return { kind: 'fast-start', type, purpose: body || '(unspecified)' };
}

function parseVerse(body) {
  const m = body.match(/^([1-3]?\s?[A-Za-z]+(?:\s+of\s+[A-Za-z]+)?)\s+(\d+)(?::(\d+(?:-\d+)?))?/);
  if (!m) return { kind: 'verse', error: 'need a passage. <code>/verse Romans 8:28 observation here</code>' };

  const bookGuess = m[1].trim();
  const sorted = [...BIBLE_BOOKS].sort((a, b) => b.length - a.length);
  const book = sorted.find(b => fuzzyMatch(b, bookGuess)) || bookGuess;
  const chapter = Number(m[2]);
  const verse = m[3] || '';
  const passage = `${book} ${chapter}${verse ? ':' + verse : ''}`;
  const observation = body.slice(m[0].length).trim();
  return { kind: 'verse', passage, passageBook: book, passageChapter: chapter, observation };
}

function parseTask(body) {
  const priority = (body.match(/!P([0-3])/i) || [, 'P2'])[1].startsWith('P') ? 'P2' : 'P' + (body.match(/!P([0-3])/i) || [, '2'])[1];
  const pm = body.match(/!P([0-3])/i);
  const prio = pm ? `P${pm[1]}` : 'P2';

  const dm = body.match(/@(\d{4}-\d{2}-\d{2}|tomorrow|today)/i);
  let scheduledFor = new Date().toISOString().slice(0, 10);
  if (dm) {
    const raw = dm[1].toLowerCase();
    if (raw === 'tomorrow') { const d = new Date(); d.setDate(d.getDate() + 1); scheduledFor = d.toISOString().slice(0, 10); }
    else if (raw !== 'today') scheduledFor = raw;
  }

  const linkMatch = body.match(/→(project|plan|idea|event):(\S+)/i);
  let linkHint = null;
  if (linkMatch) linkHint = { kind: linkMatch[1].toLowerCase(), hint: linkMatch[2] };

  const title = body
    .replace(/!P[0-3]/i, '')
    .replace(/@(\d{4}-\d{2}-\d{2}|tomorrow|today)/i, '')
    .replace(/→\w+:\S+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { kind: 'task', title, priority: prio, scheduledFor, linkHint };
}

function parsePlan(body) {
  const sorted = [...VENTURES].sort((a, b) => b.length - a.length);
  let venture = 'Other', rest = body;
  for (const v of sorted) {
    const lower = body.toLowerCase();
    if (lower === v.toLowerCase() || lower.startsWith(v.toLowerCase() + ' ')) {
      venture = v;
      rest = body.slice(v.length).trim();
      break;
    }
  }
  const firstClause = rest.split(/[.\n,—]/)[0].trim();
  const title = firstClause.length < rest.length ? firstClause : rest.slice(0, 48).trim();
  return { kind: 'plan', venture, thesis: rest, title };
}

function parseProject(body) {
  const planMatch = body.match(/→plan:(\S+)/i);
  let planHint = null;
  if (planMatch) {
    planHint = planMatch[1];
    body = body.replace(planMatch[0], '').trim();
  }
  return { kind: 'project', title: body, planHint };
}

function parseEvent(body) {
  const m = body.match(/(today|tomorrow|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?|\d{4}-\d{2}-\d{2})\s+(\d{1,2}(?::\d{2})?)\s*-\s*(\d{1,2}(?::\d{2})?)\s*$/i);
  if (!m) return { kind: 'event', error: 'need a time. <code>/event title tomorrow 9-10</code>' };

  const dateRef = m[1].toLowerCase();
  const startTime = normalizeTime(m[2]);
  const endTime   = normalizeTime(m[3]);

  let date;
  if (dateRef === 'today')         date = new Date();
  else if (dateRef === 'tomorrow') { date = new Date(); date.setDate(date.getDate() + 1); }
  else if (/^\d{4}-\d{2}-\d{2}$/.test(dateRef)) date = new Date(dateRef + 'T00:00:00');
  else {
    const map = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    const target = map[dateRef.slice(0, 3)];
    date = new Date();
    while (date.getDay() !== target) date.setDate(date.getDate() + 1);
  }

  const d = date.toISOString().slice(0, 10);
  const title = body.replace(m[0], '').trim() || '(untitled)';
  return { kind: 'event', title, startAt: `${d}T${startTime}:00`, endAt: `${d}T${endTime}:00` };
}

function normalizeTime(t) {
  if (t.includes(':')) {
    const [h, m] = t.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  }
  return `${t.padStart(2, '0')}:00`;
}

// --- writer ---

async function write(parsed) {
  if (parsed.kind === 'help') {
    return [
      '<code>/idea ...</code>',
      '<code>/task ... !P0 @tomorrow →project:abc</code>',
      '<code>/plan SME Hub thesis goes here</code>',
      '<code>/project title →plan:sme</code>',
      '<code>/event title tomorrow 9-10</code>',
      '<code>/spend GHS 450 fuel #transport @AGL</code>',
      '<code>/income GHS 5000 retainer @JonMon</code>',
      '<code>/pray for promotion at AGL !4</code>',
      '<code>/fast start water for clarity</code>',
      '<code>/fast end clarity received</code>',
      '<code>/verse Romans 8:28 observation here</code>',
      '<code>/dream vision saw a wide river opening east</code>',
      '<code>/meal lunch jollof + grilled tilapia GHS 45 @restaurant</code>',
      '<code>/book reading "Atomic Habits" by James Clear</code>',
      '<code>/note current chapter 4 changed how i think about identity</code>',
      '<code>/quiz</code> (surface random due) · <code>/quiz from bible:romans</code>',
      '<code>/research "Sacred Echo"</code>',
      '<code>/sync connect</code> · <code>/sync export</code> · <code>/sync inbox</code>',
      '<code>/blog seed raw thought goes here</code>',
      '<code>/blog draft &lt;id-suffix&gt;</code> · <code>/blog publish-static &lt;id-suffix&gt;</code>',
      '<code>/voice train</code> · <code>/voice list</code> · <code>/voice active personal</code>',
      '<code>/sync outbox</code> (pending publishes)',
      '<code>/find &lt;query&gt;</code> · <code>/fti</code> · <code>/export json</code>',
      '<code>/testimony the day God showed up</code>',
      '<code>/music "Way Maker" by Sinach · morning prayer</code>',
      '<code>/person Kojo · mechanic at AGL</code>',
      '<code>/today freeform appended to today</code>',
      '<code>/ask &lt;question for claude&gt;</code> · <code>/draft &lt;what to write&gt;</code>',
    ].join(' · ');
  }

  if (parsed.kind === 'ask' || parsed.kind === 'draft') {
    const sys = parsed.kind === 'draft'
      ? 'You are Nes, drafting prose for Adwoa. Terse, lowercase, anchored in her faith-driven multi-venture context. No filler.'
      : null;

    // Prefer Claude Desktop bridge (uses chat plan, no API cost).
    const { isConnected } = await import('./bridge.js');
    if (isConnected()) {
      try {
        const { askViaBridge, pollForReply } = await import('./claude-bridge.js');
        const id = await askViaBridge(parsed.prompt, { kind: parsed.kind, system: sys });
        push('bot', `<span class="meta">claude desktop · waiting for reply · <code>${esc(id.slice(-8))}</code></span>`);
        const text = await pollForReply(id, { timeoutMs: 180000, intervalMs: 1500 });
        return `<div class="ask-reply">${esc(text).replace(/\n/g, '<br>')}</div>`;
      } catch (err) {
        return `bridge · <span class="meta">${esc(err.message)}</span>`;
      }
    }

    // Fallback to API if configured.
    try {
      const { askClaude } = await import('./claude-client.js');
      const { text } = await askClaude(parsed.prompt, { system: sys, maxTokens: 900 });
      return `<div class="ask-reply">${esc(text).replace(/\n/g, '<br>')}</div>`;
    } catch (err) {
      return `claude · <span class="meta">${esc(err.message)} — connect claude desktop bridge in /settings or add api key.</span>`;
    }
  }

  if (parsed.kind === 'idea') {
    const e = { id: ulid(), title: parsed.body.split('\n')[0].slice(0, 80), body: parsed.body, status: 'active', weight: 50, tags: [] };
    await put('ideas', e);
    return `idea · <code>${e.id.slice(-6)}</code> · ${esc(e.title)}`;
  }

  if (parsed.kind === 'task') {
    if (!parsed.title) throw new Error('task needs a title');
    let linkedTo = null, linkMsg = '';
    if (parsed.linkHint) {
      const storeName = { project: 'projects', plan: 'plans', idea: 'ideas', event: 'events' }[parsed.linkHint.kind];
      const items = await all(storeName);
      const found = items.find(x => x.id.toLowerCase().endsWith(parsed.linkHint.hint.toLowerCase())
                                 || fuzzyMatch(x.title || '', parsed.linkHint.hint)
                                 || fuzzyMatch(x.venture || '', parsed.linkHint.hint));
      if (found) { linkedTo = found.id; linkMsg = ` → ${parsed.linkHint.kind}:${found.id.slice(-6)}`; }
      else linkMsg = ` (${parsed.linkHint.kind} "${parsed.linkHint.hint}" not found)`;
    }
    const t = { id: ulid(), title: parsed.title, priority: parsed.priority, scheduledFor: parsed.scheduledFor, context: 'shallow', status: 'active', linkedTo };
    await put('tasks', t);
    return `task · <code>${t.id.slice(-6)}</code> · ${t.priority} · for ${t.scheduledFor}${linkMsg}`;
  }

  if (parsed.kind === 'plan') {
    const p = {
      id: ulid(),
      venture: parsed.venture,
      title: parsed.title || `${parsed.venture} plan`,
      thesis: parsed.thesis,
      phase: 'concept',
      status: 'active',
      weight: 50,
      milestones: [],
      kpis: [],
    };
    await put('plans', p);
    return `plan · <code>${p.id.slice(-6)}</code> · ${esc(p.venture)} · ${esc(p.title)}`;
  }

  if (parsed.kind === 'project') {
    if (!parsed.title) throw new Error('project needs a title');
    let parentPlan = null, planMsg = '';
    if (parsed.planHint) {
      const plans = await all('plans');
      const found = plans.find(p => fuzzyMatch(p.venture, parsed.planHint) || fuzzyMatch(p.title || '', parsed.planHint));
      if (found) { parentPlan = found.id; planMsg = ` → ${found.venture}`; }
      else planMsg = ` (plan "${parsed.planHint}" not found)`;
    }
    const p = { id: ulid(), title: parsed.title, phase: 'brief', parentPlan, status: 'active' };
    await put('projects', p);
    return `project · <code>${p.id.slice(-6)}</code> · ${esc(parsed.title)}${planMsg}`;
  }

  if (parsed.kind === 'event') {
    if (parsed.error) return parsed.error;
    const e = { id: ulid(), title: parsed.title, startAt: parsed.startAt, endAt: parsed.endAt, type: 'meeting', attendees: [] };
    await put('events', e);
    return `event · <code>${e.id.slice(-6)}</code> · ${esc(e.title)} · ${e.startAt.slice(5, 16).replace('T', ' ')}`;
  }

  if (parsed.kind === 'tx') {
    if (parsed.error) return parsed.error;
    const t = {
      id: ulid(),
      date: parsed.date,
      direction: parsed.direction,
      amountGhs: parsed.amount,
      category: parsed.category,
      payee: parsed.payee,
      memo: parsed.memo,
      venture: parsed.venture,
      tithe: parsed.tithe ? 'yes' : 'no',
      account: 'MoMo',
    };
    await put('transactions', t);
    const sign = parsed.direction === 'out' ? '−' : '+';
    return `${parsed.direction === 'out' ? 'spend' : 'income'} · <code>${t.id.slice(-6)}</code> · ${sign}GHS ${t.amountGhs} · ${esc(parsed.payee)} · ${esc(parsed.category)} · ${esc(parsed.venture)}${parsed.tithe ? ' · tithe' : ''}`;
  }

  if (parsed.kind === 'prayer') {
    let linkedTo = null, linkMsg = '';
    if (parsed.linkHint) {
      const map = { plan: 'plans', project: 'projects', dream: 'dreams', idea: 'ideas' };
      const items = await all(map[parsed.linkHint.kind]);
      const found = items.find(x => x.id.toLowerCase().endsWith(parsed.linkHint.hint.toLowerCase())
                                 || fuzzyMatch(x.title || x.venture || '', parsed.linkHint.hint));
      if (found) { linkedTo = found.id; linkMsg = ` → ${parsed.linkHint.kind}:${found.id.slice(-6)}`; }
    }
    const p = {
      id: ulid(),
      subject: parsed.subject,
      type: parsed.type,
      intensity: parsed.intensity,
      startedOn: new Date().toISOString().slice(0, 10),
      answer: 'pending',
      cadence: 'one-off',
      status: 'active',
      linkedTo,
    };
    await put('prayers', p);
    return `prayer · <code>${p.id.slice(-6)}</code> · ${esc(parsed.type)} · ${esc(parsed.subject)} · !${parsed.intensity}${linkMsg}`;
  }

  if (parsed.kind === 'fast-start') {
    const f = {
      id: ulid(),
      type: parsed.type,
      purpose: parsed.purpose,
      startedAt: new Date().toISOString(),
      status: 'active',
    };
    await put('fasts', f);
    return `fast started · <code>${f.id.slice(-6)}</code> · ${esc(parsed.type)} · ${esc(parsed.purpose)}`;
  }

  if (parsed.kind === 'fast-end') {
    const fasts = await all('fasts');
    const open = fasts.filter(f => !f.endedAt).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))[0];
    if (!open) return 'no active fast to end.';
    open.endedAt = new Date().toISOString();
    open.reflection = parsed.reflection;
    open.status = 'completed';
    await put('fasts', open);
    const hours = Math.round((new Date(open.endedAt) - new Date(open.startedAt)) / 3600000);
    return `fast ended · <code>${open.id.slice(-6)}</code> · ${hours}h · ${esc(open.purpose)}`;
  }

  if (parsed.kind === 'verse') {
    if (parsed.error) return parsed.error;
    const b = {
      id: ulid(),
      passage: parsed.passage,
      passageBook: parsed.passageBook,
      passageChapter: parsed.passageChapter,
      observation: parsed.observation,
      translation: 'NIV',
      status: 'active',
    };
    await put('bible', b);
    return `verse · <code>${b.id.slice(-6)}</code> · ${esc(parsed.passage)}`;
  }

  if (parsed.kind === 'dream') {
    const d = {
      id: ulid(),
      title: parsed.title || '(untitled dream)',
      body: parsed.body,
      type: parsed.type,
      symbols: parsed.symbols,
      dreamDate: new Date().toISOString().slice(0, 10),
      status: 'active',
      weight: 50,
    };
    await put('dreams', d);
    return `dream · <code>${d.id.slice(-6)}</code> · ${esc(d.type)} · ${esc(d.title)}`;
  }

  if (parsed.kind === 'meal') {
    const m = {
      id: ulid(),
      date: parsed.date,
      slot: parsed.slot,
      actualItems: parsed.actualItems,
      costGhs: parsed.costGhs,
      source: parsed.source,
      homeCooked: parsed.homeCooked,
    };
    await put('meals', m);
    const itemSum = formatList(parsed.actualItems);
    return `meal · <code>${m.id.slice(-6)}</code> · ${esc(parsed.slot)} · ${esc(itemSum)}${parsed.costGhs ? ' · GHS ' + parsed.costGhs : ''}`;
  }

  if (parsed.kind === 'testimony') {
    const t = {
      id: ulid(),
      title: parsed.body.split('\n')[0].slice(0, 80),
      body: parsed.body,
      date: new Date().toISOString().slice(0, 10),
      status: 'active',
    };
    await put('testimonies', t);
    return withScripture(
      `testimony · <code>${t.id.slice(-6)}</code> · ${esc(t.title)}`,
      { ref: 'Revelation 12:11', text: 'overcame him by the blood of the Lamb and by the word of their testimony.' }
    );
  }

  if (parsed.kind === 'music') {
    const m = {
      id: ulid(),
      title: parsed.title,
      artist: parsed.artist,
      heard: parsed.heard,
      date: new Date().toISOString().slice(0, 10),
    };
    await put('music', m);
    return withScripture(
      `song · <code>${m.id.slice(-6)}</code> · "${esc(m.title)}"${m.artist ? ' · ' + esc(m.artist) : ''}`,
      { ref: 'Ephesians 5:19', text: 'speak to one another with psalms, hymns, and spiritual songs.' }
    );
  }

  if (parsed.kind === 'person') {
    const p = {
      id: ulid(),
      name: parsed.name,
      note: parsed.note,
      lastTouchedAt: new Date().toISOString().slice(0, 10),
      role: '',
      tags: '',
      pray: 'no',
    };
    await put('people', p);
    return withScripture(
      `person · <code>${p.id.slice(-6)}</code> · ${esc(parsed.name)}`,
      { ref: 'Matthew 22:39', text: 'love your neighbor as yourself.' }
    );
  }

  if (parsed.kind === 'book') {
    const b = {
      id: ulid(),
      title: parsed.title,
      author: parsed.author,
      status: parsed.status,
      format: 'book',
      startedOn:  ['reading','paused','finished'].includes(parsed.status) ? new Date().toISOString().slice(0,10) : null,
      finishedOn: parsed.status === 'finished' ? new Date().toISOString().slice(0,10) : null,
      notes: '', keyIdeas: '', themes: '',
    };
    await put('books', b);
    return `book · <code>${b.id.slice(-6)}</code> · ${esc(parsed.status)} · ${esc(b.title)}${b.author ? ' by ' + esc(b.author) : ''}`;
  }

  if (parsed.kind === 'note') {
    if (parsed.error) return parsed.error;
    let target, storeName;
    if (parsed.target.toLowerCase() === 'current') {
      const books = await all('books');
      target = books.find(b => b.status === 'reading');
      storeName = 'books';
      if (!target) return 'no current book. <code>/book reading "Title" by Author</code> first.';
    } else {
      const books  = await all('books');
      const bibles = await all('bible');
      target = books.find(b => b.id.toLowerCase().endsWith(parsed.target.toLowerCase()));
      if (target) storeName = 'books';
      else {
        target = bibles.find(b => b.id.toLowerCase().endsWith(parsed.target.toLowerCase()));
        if (target) storeName = 'bible';
      }
      if (!target) return `not found · <code>${esc(parsed.target)}</code>`;
    }
    const existing = target.notes || '';
    const stamped  = `[${new Date().toISOString().slice(0, 10)}] ${parsed.text}`;
    const next = { ...target, notes: (existing ? existing + '\n\n' : '') + stamped };
    await put(storeName, next);
    return `note appended · <code>${target.id.slice(-6)}</code> · ${esc(target.title || target.passage)}`;
  }

  if (parsed.kind === 'quiz-next') {
    const quizzes = await all('quizzes');
    const now = new Date().toISOString();
    const due = quizzes.filter(q => (q.status !== 'mastered' && q.status !== 'archived') && (!q.nextDueAt || q.nextDueAt <= now));
    if (due.length === 0) return 'no quizzes due. <code>/quiz from bible:romans</code> to generate via claude.';
    const pick = due[Math.floor(Math.random() * due.length)];
    return `due · <code>${pick.id.slice(-6)}</code> · ${esc(pick.sourceLabel || '?')}<br><strong>${esc(pick.question)}</strong><br><em>open in drawer or visit /quizzes to answer</em>`;
  }

  if (parsed.kind === 'quiz-prompt') {
    return quizPrompt(parsed.source);
  }

  if (parsed.kind === 'research-prompt') {
    return researchPrompt(parsed.target);
  }

  if (parsed.kind === 'sync') {
    if (parsed.op === 'connect') {
      try {
        const name = await bridgeConnect();
        return `bridge connected · <code>${esc(name)}</code> · see <code>MIRACLE.md</code> in that folder for instructions to claude desktop.`;
      } catch (e) { return `bridge error · ${esc(e.message)}`; }
    }
    if (parsed.op === 'export') {
      if (!bridgeIsConnected()) return 'bridge not connected. <code>/sync connect</code>';
      const s = await bridgeExport();
      const total = Object.values(s.counts).reduce((a, b) => a + b, 0);
      return `exported · ${total} rows across ${Object.keys(s.counts).length} stores`;
    }
    if (parsed.op === 'inbox') {
      if (!bridgeIsConnected()) return 'bridge not connected. <code>/sync connect</code>';
      const items = await bridgeInbox();
      if (items.length === 0) return 'inbox empty.';
      return `${items.length} item(s):<br>` + items.map(i => `· <code>${esc(i.name)}</code> · ${i.data?.kind || i.error || 'unknown'}`).join('<br>') + `<br><em>commit with <code>/sync apply &lt;name&gt;</code></em>`;
    }
    if (parsed.op === 'outbox') {
      if (!bridgeIsConnected()) return 'bridge not connected.';
      const items = await bridgeOutbox();
      if (items.length === 0) return 'outbox empty.';
      return `${items.length} pending:<br>` + items.map(i => `· <code>${esc(i.platform)}/${esc(i.name)}</code>`).join('<br>');
    }
    if (parsed.op === 'apply') {
      if (!bridgeIsConnected()) return 'bridge not connected.';
      const r = await bridgeApply(parsed.name);
      return `applied · ${r.applied} rows from <code>${esc(r.name)}</code>`;
    }
    return 'unknown sync op.';
  }

  if (parsed.kind === 'blog-seed') {
    if (!parsed.body) return 'usage: <code>/blog seed your raw thought</code>';
    const b = {
      id: ulid(),
      seedText: parsed.body,
      seedSource: 'miracle',
      seedCapturedAt: new Date().toISOString(),
      title: parsed.body.split(/[.\n]/)[0].trim().slice(0, 60),
      hook: '',
      longForm: '',
      status: 'seeding',
      variants: [],
      topics: '', series: '', cta: '',
      scriptureRefs: '',
    };
    await put('blogs', b);
    return `seed · <code>${b.id.slice(-6)}</code> · ${esc(b.title)}`;
  }

  if (parsed.kind === 'blog-draft') {
    const blogs = await all('blogs');
    const target = blogs.find(b => b.id.toLowerCase().endsWith((parsed.hint || '').toLowerCase()))
                || blogs.find(b => fuzzyMatch(b.title || '', parsed.hint || ''));
    if (!target) return `blog not found · <code>${esc(parsed.hint)}</code>`;
    return blogDraftPrompt(target);
  }

  if (parsed.kind === 'blog-publish-static') {
    const blogs = await all('blogs');
    const target = blogs.find(b => b.id.toLowerCase().endsWith((parsed.hint || '').toLowerCase()))
                || blogs.find(b => fuzzyMatch(b.title || '', parsed.hint || ''));
    if (!target) return `blog not found · <code>${esc(parsed.hint)}</code>`;
    try {
      const { exportBlogStatic } = await import('./blog-export.js');
      const r = await exportBlogStatic(target.id);
      return `published static · <code>${esc(r.file)}</code>`;
    } catch (e) { return `error · ${esc(e.message)}`; }
  }

  if (parsed.kind === 'voice-train') {
    return voiceTrainPrompt(parsed.hint);
  }

  if (parsed.kind === 'voice-active') {
    const all_ = await all('voiceProfiles');
    const match = all_.find(v => fuzzyMatch(v.name || '', parsed.name));
    if (!match) return `voice not found · <code>${esc(parsed.name)}</code>`;
    for (const v of all_) {
      const next = { ...v, active: v.id === match.id ? 'yes' : 'no' };
      await put('voiceProfiles', next);
    }
    return `active voice · <code>${esc(match.name)}</code>`;
  }

  if (parsed.kind === 'voice-list') {
    const list = await all('voiceProfiles');
    if (!list.length) return 'no voice profiles. <code>/voice train</code> to bootstrap one via claude.';
    return list.map(v => `· <code>${v.id.slice(-6)}</code> · ${esc(v.name)}${v.active === 'yes' ? ' · <span style="color:var(--emerald)">active</span>' : ''}`).join('<br>');
  }

  if (parsed.kind === 'find') {
    const { search } = await import('./search.js');
    const res = await search(parsed.q);
    if (res.length === 0) return `no matches for <code>${esc(parsed.q)}</code>`;
    return res.slice(0, 8).map(r => `· <code>${(r.id || '').slice(-6)}</code> · ${esc(r.store)} · ${esc(r.title || '')}`).join('<br>') + `<br><em>more in /search?q=${encodeURIComponent(parsed.q)}</em>`;
  }

  if (parsed.kind === 'fti') {
    const { computeFTI } = await import('./fti.js');
    const r = await computeFTI();
    return `fti · <strong>${r.score}</strong>/100<br>` + Object.entries(r.components).map(([k, v]) => `· ${k} · ${Math.round(v * 100)}%`).join('<br>');
  }

  if (parsed.kind === 'export-json') {
    const stores = ['daily','dreams','ideas','bible','prayers','fasts','plans','projects','tasks','events','meals','transactions','budgets','blogs','books','quizzes','voiceProfiles','postMetrics','fti','tags','meta'];
    const dump = {};
    for (const s of stores) {
      try { dump[s] = await all(s); } catch {}
    }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hobonichi-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return `downloaded · ${Object.keys(dump).length} stores · ${Object.values(dump).reduce((s, v) => s + v.length, 0)} rows`;
  }

  if (parsed.kind === 'today') {
    const date = new Date().toISOString().slice(0, 10);
    const existing = (await get('daily', date)) || { date };
    const prev = existing.freeform || '';
    await put('daily', { ...existing, date, freeform: (prev ? prev + '\n' : '') + parsed.body });
    return `appended to today`;
  }

  return 'unknown';
}
