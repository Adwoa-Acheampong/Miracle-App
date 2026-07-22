// nes-nlu.js — Rule-based intent classifier + entity extractor.
// No external API. Deterministic. Returns { intent, tool, args, confidence }.
//
// Design:
//   - Intents are ordered most-specific first; first regex match wins.
//   - Each intent has a `test(t)` and a `build(t)`. build() returns { tool, args, confidence }.
//   - Below 0.4 confidence the agent falls back to slash-command hints.

const TODAY    = () => new Date().toISOString().slice(0, 10);
const TOMORROW = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };

// ============================================================
// VOCABULARIES
// ============================================================

const VENTURES = ['SME Hub', 'Real Estate Hub', 'TyT-KoKus', 'Crushed Diamond', 'Havilah', 'AGL', 'JonMon', 'Personal', 'Other'];

const STORE_SYNONYMS = {
  ideas:        ['idea', 'ideas', 'thought', 'thoughts', 'concept', 'concepts'],
  tasks:        ['task', 'tasks', 'todo', 'todos', 'to-do', 'reminder', 'reminders'],
  prayers:      ['prayer', 'prayers', 'intercession', 'praying'],
  prophecies:   ['prophecy', 'prophecies', 'word', 'words received', 'prophetic word'],
  bible:        ['bible', 'verse', 'verses', 'scripture', 'passage', 'devotion'],
  dreams:       ['dream', 'dreams', 'vision', 'visions'],
  testimonies:  ['testimony', 'testimonies', 'breakthrough', 'breakthroughs'],
  blogs:        ['blog', 'blogs', 'post', 'posts', 'article'],
  projects:     ['project', 'projects'],
  plans:        ['plan', 'plans', 'venture', 'ventures'],
  people:       ['person', 'people', 'contact', 'contacts'],
  books:        ['book', 'books', 'reading'],
  transactions: ['transaction', 'transactions', 'spend', 'spending', 'income', 'expense', 'money'],
  events:       ['event', 'events', 'meeting', 'meetings', 'calendar'],
  fasts:        ['fast', 'fasts', 'fasting'],
  meals:        ['meal', 'meals', 'food', 'eat', 'eating'],
  music:        ['song', 'songs', 'music'],
  daily:        ['journal', 'today', 'daily', 'entry', 'entries'],
};

function detectStores(text) {
  const lower = ` ${text.toLowerCase()} `;
  const hits = [];
  for (const [store, syns] of Object.entries(STORE_SYNONYMS)) {
    if (syns.some(s => lower.includes(` ${s} `) || lower.includes(`${s}s `) || lower.includes(`${s},`) || lower.includes(`${s}?`))) {
      hits.push(store);
    }
  }
  return hits;
}

// ============================================================
// EXTRACTORS
// ============================================================

function extractPriority(t) {
  const m = t.match(/!?P([0-3])\b/i);
  if (m) return `P${m[1]}`;
  if (/\b(urgent|asap|critical|p0)\b/i.test(t)) return 'P0';
  if (/\b(important|high priority|p1)\b/i.test(t)) return 'P1';
  if (/\b(low priority|whenever|someday|p3)\b/i.test(t)) return 'P3';
  return 'P2';
}

function extractDate(t) {
  const m = t.match(/@(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  if (/\b(tomorrow|tmr|tmrw)\b/i.test(t)) return TOMORROW();
  if (/\b(today|tonight|now)\b/i.test(t))  return TODAY();
  return null;
}

function extractAmount(t) {
  const m = t.match(/(?:GHS|ghs|₵|cedis?)\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(?:GHS|ghs|₵|cedis?)/i);
  if (!m) return null;
  return Number((m[1] || m[2]).replace(/,/g, ''));
}

function extractVenture(t) {
  const m = t.match(/@([A-Za-z][A-Za-z0-9-]*)/);
  if (m) {
    const lower = m[1].toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = [...VENTURES].sort((a, b) => b.length - a.length)
      .find(v => v.toLowerCase().replace(/[^a-z0-9]/g, '') === lower);
    if (found) return found;
  }
  for (const v of VENTURES) {
    const re = new RegExp(`\\b${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(t)) return v;
  }
  return null;
}

function extractCategory(t) {
  const m = t.match(/#([a-z][a-z0-9-]*)/i);
  if (m) return m[1].toLowerCase();
  const inferred = {
    food:          /\b(food|breakfast|lunch|dinner|jollof|rice|chicken|kenkey|fufu|banku|waakye)\b/i,
    transport:     /\b(transport|uber|bolt|taxi|trotro)\b/i,
    fuel:          /\b(fuel|petrol|diesel|gas|filling)\b/i,
    rent:          /\brent\b/i,
    utilities:     /\b(electric|electricity|water|internet|data|airtime|bills?)\b/i,
    subscriptions: /\b(subscription|netflix|spotify|saas)\b/i,
    health:        /\b(health|medical|hospital|clinic|pharmacy|drugs?)\b/i,
    family:        /\bfamily\b/i,
    inventory:     /\binventory\b/i,
    capex:         /\b(capex|equipment|laptop|machine)\b/i,
    tithe:         /\btithe\b/i,
    giving:        /\b(give|giving|offering|donation)\b/i,
  };
  for (const [cat, re] of Object.entries(inferred)) if (re.test(t)) return cat;
  return 'misc';
}

function extractIntensity(t) {
  const m = t.match(/!([1-5])\b/);
  if (m) return Number(m[1]);
  if (/\b(urgent|warring|war|warfare|desperate)\b/i.test(t)) return 5;
  if (/\b(strong|heavy)\b/i.test(t)) return 4;
  if (/\b(light|passing|small)\b/i.test(t)) return 2;
  return 3;
}

function extractPrayerType(t) {
  if (/\b(thank|thanksgiving|grateful|gratitude)\b/i.test(t)) return 'thanksgiving';
  if (/\b(confess|confession|repent|sin)\b/i.test(t)) return 'confession';
  if (/\b(warfare|battle|war)\b/i.test(t)) return 'warfare';
  if (/\b(intercede|intercession|for\s+(my|the))\b/i.test(t)) return 'intercession';
  return 'supplication';
}

function extractDirection(t) {
  if (/\b(spend|spent|paid|bought|expense|cost|out)\b/i.test(t)) return 'out';
  if (/\b(income|received|earned|got paid|paid me|salary|revenue|in)\b/i.test(t)) return 'in';
  return null;
}

function extractMood(t) {
  if (/\b(joy|joyful|happy|elated|grateful)\b/i.test(t)) return 'joyful';
  if (/\b(tired|exhausted|spent|drained|weary)\b/i.test(t)) return 'tired';
  if (/\b(focused|sharp|clear)\b/i.test(t)) return 'focused';
  if (/\b(anxious|worried|stressed)\b/i.test(t)) return 'anxious';
  if (/\b(low|sad|down)\b/i.test(t)) return 'low';
  return 'steady';
}

// 4-12 char id suffix detector — matches ULID tail, hex hash, etc.
function extractIdSuffix(t) {
  const m = t.match(/\b([a-z0-9]{4,12})\b(?:\s|$|[.?!,])/i);
  if (!m) return null;
  // avoid matching common words
  const stop = new Set(['task','tasks','idea','ideas','prayer','prayers','dream','dreams','done','today','now','update','complete','reopen','answer','delete','priority','high','low','book','blog','plan','plans','project','projects','venture','status','active','venture','breakthrough','recent','show','find','about','that','this','tomorrow','tonight','please','recent','latest','first','last','open','close']);
  return stop.has(m[1].toLowerCase()) ? null : m[1];
}

function extractBookTitle(t) {
  const m = t.match(/book[:\s]+["']?([^"'\n,]+?)["']?(?:\s+by\s+([^,\n]+))?(?:[.?!]|$)/i);
  if (m) return { title: m[1].trim(), author: (m[2] || '').trim() };
  return null;
}

function stripBoilerplate(t) {
  return t
    .replace(/^(hey nes|nes|hello|hi)[,!\s]+/i, '')
    .replace(/^(please|pls|can you|could you|would you|will you)\s+/i, '')
    .trim();
}

// ============================================================
// INTENTS — ordered by specificity
// ============================================================

const INTENTS = [
  // ─────────────── update / lifecycle ───────────────
  {
    name: 'complete_task',
    test: t => /\b(complete|finish|done with|mark .* done|tick off|check off)\b/i.test(t) &&
              (/\btask\b/i.test(t) || extractIdSuffix(t)),
    build: t => ({
      tool: 'complete_task',
      args: { idSuffix: extractIdSuffix(t) },
      confidence: extractIdSuffix(t) ? 0.95 : 0.4,
    }),
  },
  {
    name: 'reopen_task',
    test: t => /\b(reopen|undo|not done|still doing|reactivate)\b/i.test(t) && /\btask\b/i.test(t),
    build: t => ({
      tool: 'reopen_task',
      args: { idSuffix: extractIdSuffix(t) },
      confidence: extractIdSuffix(t) ? 0.9 : 0.4,
    }),
  },
  {
    name: 'answer_prayer',
    test: t => /\b(answer|answered|god (came through|provided|did it|moved)|breakthrough)\b/i.test(t) &&
              /\bprayer\b/i.test(t) && extractIdSuffix(t),
    build: t => ({
      tool: 'answer_prayer',
      args: {
        idSuffix: extractIdSuffix(t),
        howGod: t.replace(/\b(answered|prayer)\b/gi, '').trim().slice(0, 200),
        when: extractDate(t),
      },
      confidence: 0.9,
    }),
  },
  {
    name: 'update_task',
    test: t => /\b(update|change|move|reschedule|reprioritize|set)\b.*\btask\b/i.test(t) && extractIdSuffix(t),
    build: t => {
      const patch = {};
      if (/!?P[0-3]/i.test(t)) patch.priority = extractPriority(t);
      const d = extractDate(t);
      if (d) patch.scheduledFor = d;
      // title rewrite: "rename task abc123 to <new title>"
      const re = /\b(rename|retitle|title to|change title to)\b\s+(.+)$/i.exec(t);
      if (re) patch.title = re[2].replace(/^["']|["']$/g, '').trim();
      return {
        tool: 'update_task',
        args: { idSuffix: extractIdSuffix(t), patch },
        confidence: Object.keys(patch).length ? 0.85 : 0.4,
      };
    },
  },
  {
    name: 'end_fast',
    test: t => /\b(end|break|finish)\b.*\bfast\b/i.test(t) && extractIdSuffix(t),
    build: t => ({
      tool: 'end_fast',
      args: {
        idSuffix: extractIdSuffix(t),
        breakthrough: t.replace(/\b(end|break|finish|fast)\b/gi, '').trim().slice(0, 300),
      },
      confidence: 0.85,
    }),
  },
  {
    name: 'delete_entry',
    test: t => /\b(delete|remove|trash|drop)\b/i.test(t) && detectStores(t).length && extractIdSuffix(t),
    build: t => ({
      tool: 'delete_entry',
      args: { store: detectStores(t)[0], idSuffix: extractIdSuffix(t) },
      confidence: 0.85,
    }),
  },

  // ─────────────── summaries (specific first) ───────────────
  {
    name: 'summarize_finances',
    test: t => /\b(spend|spending|spent|income|finance|finances|money|net|cash)\b/i.test(t) &&
              /\b(this (week|month|year)|last (week|month|year)|recap|summary|overview)\b/i.test(t),
    build: t => {
      const period = /\bmonth\b/i.test(t) ? 'month' : /\byear\b/i.test(t) ? 'year' : 'week';
      return { tool: 'summarize_finances', args: { period }, confidence: 0.9 };
    },
  },
  {
    name: 'summarize_venture',
    test: t => /\b(how is|how('?s| is)|health of|status of|state of|summary of|how('?s| is) my)\b/i.test(t) &&
              extractVenture(t),
    build: t => ({
      tool: 'summarize_venture',
      args: { venture: extractVenture(t) },
      confidence: 0.85,
    }),
  },
  {
    name: 'summarize_week',
    test: t => /\b(this week|past week|weekly (recap|summary|review)|recap (this )?week|week in review)\b/i.test(t) ||
              /^(recap|summary|debrief)\b/i.test(t),
    build: () => ({ tool: 'summarize_week', args: {}, confidence: 0.9 }),
  },
  {
    name: 'summarize_month',
    test: t => /\b(this month|past month|monthly (recap|summary|review)|month in review)\b/i.test(t),
    build: () => ({ tool: 'summarize_month', args: {}, confidence: 0.9 }),
  },

  // ─────────────── read ───────────────
  {
    name: 'search_about',
    test: t => /\b(do i have|did i (write|note|say|mention|capture)|find (my|the)?|search( for)?|look up|where('?s| is) my)\b/i.test(t) ||
              /\b(notes?|entries?|anything|something)\b.*\b(about|on|regarding|re)\b/i.test(t) ||
              /^(any|do i have)\s+.+\?$/i.test(t),
    build: t => {
      const stores = detectStores(t);
      const q = t
        .replace(/\b(do i have|did i (write|note|say|mention|capture)|find (my|the)?|search( for)?|look up|where('?s| is) my|any)\b/gi, '')
        .replace(/\b(notes?|entries?|anything|something)\b/gi, '')
        .replace(/\b(about|on|regarding|re)\b/gi, '')
        .replace(/[?.!]+$/g, '').trim();
      return { tool: 'search_entries', args: { query: q, stores: stores.length ? stores : undefined }, confidence: 0.85 };
    },
  },
  {
    name: 'get_entry',
    test: t => /\b(show me|open|fetch|pull up|get)\b/i.test(t) && detectStores(t).length && extractIdSuffix(t),
    build: t => ({
      tool: 'get_entry',
      args: { store: detectStores(t)[0], idSuffix: extractIdSuffix(t) },
      confidence: 0.85,
    }),
  },
  {
    name: 'recent',
    test: t => /\b(recent|latest|last (few|\d+)|show me|list)\b/i.test(t) && detectStores(t).length > 0,
    build: t => {
      const stores  = detectStores(t);
      const limM    = t.match(/\b(\d+)\b/);
      const limit   = limM ? Math.min(Number(limM[1]), 30) : 10;
      return { tool: 'get_recent', args: { store: stores[0], limit }, confidence: 0.85 };
    },
  },
  {
    name: 'count_entries',
    test: t => /\b(how many|count of|count my)\b/i.test(t) && detectStores(t).length > 0,
    build: t => ({ tool: 'count_entries', args: { store: detectStores(t)[0] }, confidence: 0.85 }),
  },
  {
    name: 'open_tasks',
    test: t => /\b(what('?s| is)? (due|on (my )?plate|next|today)|what (do|should) i do|my (open )?tasks?|due today|to[- ]do( list)?)\b/i.test(t),
    build: () => ({ tool: 'get_open_tasks', args: {}, confidence: 0.9 }),
  },
  {
    name: 'open_prayers',
    test: t => /\b(prayer (list|subjects?|wall)|what am i (praying|standing) for|active prayers?|open prayers?)\b/i.test(t),
    build: () => ({ tool: 'get_open_prayers', args: {}, confidence: 0.9 }),
  },
  {
    name: 'fti',
    test: t => /\b(fti|follow.?through|my score|how am i doing)\b/i.test(t),
    build: () => ({ tool: 'get_fti', args: {}, confidence: 0.95 }),
  },
  {
    name: 'profile',
    test: t => /\b(my (calling|profile|verse|anchor)|who am i|what('?s| is) my (calling|name|verse))\b/i.test(t),
    build: () => ({ tool: 'get_user_profile', args: {}, confidence: 0.9 }),
  },

  // ─────────────── create ───────────────
  {
    name: 'log_transaction',
    test: t => extractAmount(t) !== null && extractDirection(t) !== null,
    build: t => {
      const direction = extractDirection(t);
      const amount    = extractAmount(t);
      const category  = extractCategory(t);
      const venture   = extractVenture(t) || 'Personal';
      const tithe     = /\btithe\b/i.test(t) || category === 'tithe';
      const payee = (() => {
        const after = t.split(/(?:GHS|ghs|₵|cedis?)\s*[\d,.]+/i)[1] || '';
        const w = after.replace(/[#@][^\s]+/g, '').trim().split(/[\s,]+/)[0] || '';
        return w.replace(/[?.!]/g, '');
      })();
      return {
        tool: 'log_transaction',
        args: { direction, amount, category, venture, payee, memo: t, tithe },
        confidence: 0.88,
      };
    },
  },
  {
    name: 'start_fast',
    test: t => /\b(start|begin)\b.*\bfast\b/i.test(t) || /^fast (for|to)/i.test(t),
    build: t => {
      const hM = t.match(/(\d+)\s*(?:h|hr|hour|hours)\b/i) || t.match(/(\d+)\s*(?:day|days)\b/i);
      const plannedHours = hM ? (t.includes('day') ? Number(hM[1]) * 24 : Number(hM[1])) : 24;
      const type = /\b(dry|absolute)\b/i.test(t) ? 'dry'
                 : /\bdaniel\b/i.test(t) ? 'daniel'
                 : /\bpartial\b/i.test(t) ? 'partial'
                 : 'water';
      const purpose = t.replace(/\b(start|begin|fast|for|to)\b/gi, '').replace(/\d+\s*(?:h|hr|hour|hours|day|days)/i, '').trim();
      return { tool: 'start_fast', args: { type, plannedHours, purpose }, confidence: 0.88 };
    },
  },
  {
    name: 'create_event',
    test: t => /\b(schedule|meeting|event|appointment)\b/i.test(t) && (/@\d{4}-\d{2}-\d{2}/.test(t) || /\b(tomorrow|today)\b/i.test(t)),
    build: t => {
      const date = extractDate(t) || TODAY();
      const tM = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
      let hour = 9, min = 0;
      if (tM) { hour = Number(tM[1]); min = Number(tM[2] || 0); if (/pm/i.test(tM[3]) && hour < 12) hour += 12; }
      const startAt = `${date}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00`;
      const title = t.replace(/\b(schedule|meeting|event|appointment)\b/gi, '')
                     .replace(/\b(today|tomorrow|tonight)\b/gi, '')
                     .replace(/\d{1,2}(?::\d{2})?\s*(am|pm)/gi, '')
                     .replace(/@\S+/g, '').replace(/[?.!]+$/, '').trim() || 'untitled';
      return { tool: 'create_event', args: { title, startAt }, confidence: 0.82 };
    },
  },
  {
    name: 'create_journal',
    test: t => /\b(journal:|today i (felt|did|was)|how i feel|gratitude:)\b/i.test(t),
    build: t => {
      const isGratitude = /\bgratitude:?/i.test(t);
      const body = t.replace(/^(journal:|gratitude:)\s*/i, '').trim();
      return {
        tool: 'create_journal',
        args: isGratitude
          ? { gratitude: body, mood: extractMood(t) }
          : { oneSentence: body.split(/[.\n]/)[0].slice(0, 200), freeform: body, mood: extractMood(t) },
        confidence: 0.82,
      };
    },
  },
  {
    name: 'create_blog',
    test: t => /\bblog:?\s/i.test(t),
    build: t => {
      const body = t.replace(/^blog:?\s*/i, '').trim();
      const [title, ...rest] = body.split(/[—\-:|]\s+/);
      return { tool: 'create_blog', args: { title: (title || 'untitled').slice(0, 100), hook: rest.join(' — ').slice(0, 200) }, confidence: 0.82 };
    },
  },
  {
    name: 'create_project',
    test: t => /\bproject:\s/i.test(t) || /\b(new project)\b/i.test(t),
    build: t => {
      const body = t.replace(/^(project:|new project[:\s]+)\s*/i, '').trim();
      return { tool: 'create_project', args: { title: body.slice(0, 100), venture: extractVenture(t) || 'Personal' }, confidence: 0.82 };
    },
  },
  {
    name: 'create_plan',
    test: t => /\bplan:\s/i.test(t) || /\bnew venture\b/i.test(t),
    build: t => {
      const body = t.replace(/^(plan:|new venture[:\s]+)\s*/i, '').trim();
      return { tool: 'create_plan', args: { title: body.slice(0, 100), venture: extractVenture(t) || body.slice(0, 40) }, confidence: 0.78 };
    },
  },
  {
    name: 'create_person',
    test: t => /\b(contact:|new contact|add person|met [A-Z])\b/i.test(t),
    build: t => {
      const m = t.match(/(?:contact:|new contact|add person|met)\s+([A-Z][a-zA-Z ]+)/);
      const name = (m?.[1] || t.replace(/^contact:?\s*/i, '').split(/\s+/).slice(0, 3).join(' ')).trim();
      return { tool: 'create_person', args: { name, note: t, venture: extractVenture(t) || '' }, confidence: 0.78 };
    },
  },
  {
    name: 'create_book',
    test: t => /\bbook:\s/i.test(t) || /\b(reading|started reading|finished reading)\b/i.test(t),
    build: t => {
      const info = extractBookTitle(t);
      if (info) {
        const status = /\bfinished\b/i.test(t) ? 'finished' : /\b(reading|started)\b/i.test(t) ? 'reading' : 'wishlist';
        return { tool: 'create_book', args: { title: info.title, author: info.author, status }, confidence: 0.82 };
      }
      return { tool: 'create_book', args: { title: t.replace(/^book:?\s*/i, '').trim().slice(0, 100), status: 'wishlist' }, confidence: 0.65 };
    },
  },
  {
    name: 'log_meal',
    test: t => /\b(ate|had (for )?(breakfast|lunch|dinner|supper)|meal:)\b/i.test(t),
    build: t => {
      const slot = /\bbreakfast\b/i.test(t) ? 'breakfast'
                 : /\bdinner|supper\b/i.test(t) ? 'dinner'
                 : /\bsnack\b/i.test(t) ? 'snack'
                 : 'lunch';
      const items = t.replace(/\b(ate|had|for|breakfast|lunch|dinner|supper|snack|meal:?)\b/gi, '').trim();
      return { tool: 'log_meal', args: { slot, items, mood: extractMood(t) }, confidence: 0.78 };
    },
  },
  {
    name: 'create_task',
    test: t => /\b(remind me to|i need to|task:|add task|todo:|i should|don'?t forget to|schedule (myself )?to)\b/i.test(t),
    build: t => {
      const title = t
        .replace(/\b(remind me to|i need to|task:|add task|todo:|i should|don'?t forget to|schedule (myself )?to)\b/gi, '')
        .replace(/!?P[0-3]/gi, '').replace(/@\S+/g, '').replace(/\b(today|tomorrow|tmr|tmrw|tonight|now)\b/gi, '')
        .replace(/[?.!]+$/g, '').trim();
      return {
        tool: 'create_task',
        args: { title, priority: extractPriority(t), scheduledFor: extractDate(t) || TODAY(), venture: extractVenture(t) },
        confidence: 0.9,
      };
    },
  },
  {
    name: 'create_prayer',
    test: t => /\b(pray (for|about)|prayer (for|about)|praying (for|about)|stand (in prayer )?for|lord please)\b/i.test(t),
    build: t => {
      const subject = t
        .replace(/\b(pray (for|about)|prayer (for|about)|praying (for|about)|stand (in prayer )?for|lord please)\b/gi, '')
        .replace(/!\d/g, '').replace(/[?.!]+$/g, '').trim();
      return {
        tool: 'create_prayer',
        args: { subject, type: extractPrayerType(t), intensity: extractIntensity(t) },
        confidence: 0.88,
      };
    },
  },
  {
    name: 'create_idea',
    test: t => /\b(idea:|i('m| am) thinking|what if|new idea|i wonder|concept:|brain ?storm)\b/i.test(t),
    build: t => {
      const body = t.replace(/\b(idea:|i('m| am) thinking( that)?|what if|new idea|i wonder( if)?|concept:|brain ?storm)\b/gi, '')
                    .replace(/[?.!]+$/g, '').trim();
      return { tool: 'create_idea', args: { body }, confidence: 0.85 };
    },
  },
  {
    name: 'create_testimony',
    test: t => /\b(testimony:|god (did|showed up|came through|answered)|breakthrough|answered prayer)\b/i.test(t),
    build: t => ({ tool: 'create_testimony', args: { body: t.replace(/\btestimony:\s*/i, '').trim() }, confidence: 0.85 }),
  },
  {
    name: 'fulfill_prophecy',
    test: t => /\b(fulfill(ed)?|came to pass|came through|happened|manifested)\b/i.test(t) && /\bprophecy\b/i.test(t) && extractIdSuffix(t),
    build: t => ({
      tool: 'fulfill_prophecy',
      args: {
        idSuffix: extractIdSuffix(t),
        fulfillmentNotes: t.replace(/\b(fulfill(ed)?|prophecy|came to pass)\b/gi, '').trim().slice(0, 300),
      },
      confidence: 0.9,
    }),
  },
  {
    name: 'create_prophecy',
    test: t => /\b(prophecy:|prophetic word|i received a word|word from (the )?lord|word over me|spoken over me)\b/i.test(t),
    build: t => {
      const word = t
        .replace(/^(prophecy:|prophetic word[:\s]+|i received a word[:\s]+|word from (the )?lord[:\s]+|word (over|on) me[:\s]+|spoken over me[:\s]+)/gi, '')
        .replace(/[?.!]+$/g, '').trim();
      // "from <Speaker>" extraction
      const sMatch = t.match(/\bfrom\s+([A-Z][\w. -]{1,60})/);
      const speaker = sMatch ? sMatch[1].trim() : '';
      // platform inference
      const platform = /\bchurch\b/i.test(t) ? 'church'
                     : /\bdream\b/i.test(t) ? 'dream'
                     : /\bvision\b/i.test(t) ? 'vision'
                     : /\bsermon\b/i.test(t) ? 'sermon'
                     : /\bprayer line\b/i.test(t) ? 'prayer-line'
                     : /\bdm\b/i.test(t) ? 'DM'
                     : 'other';
      // scripture hint
      const scrip = (t.match(/\b((?:1|2|3)\s)?(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalms?|proverbs|ecclesiastes|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)\s+\d+(?::\d+(?:-\d+)?)?/i) || [])[0] || '';
      return {
        tool: 'create_prophecy',
        args: { word, speaker, platform, scripture: scrip, dateReceived: extractDate(t) || TODAY() },
        confidence: 0.85,
      };
    },
  },
  {
    name: 'create_dream',
    test: t => /\b(dream:|had a dream|i saw|in (a |the )?(dream|vision)|vision:|prophetic)\b/i.test(t),
    build: t => {
      const isVision = /\bvision\b/i.test(t);
      const isProphetic = /\bprophetic\b/i.test(t);
      const body = t.replace(/^(dream:|vision:)\s*/i, '').trim();
      return {
        tool: 'create_dream',
        args: { body, type: isProphetic ? 'prophetic' : isVision ? 'vision' : 'nightDream' },
        confidence: 0.85,
      };
    },
  },
  {
    name: 'create_verse_study',
    test: t => /\b((1|2|3)\s)?(genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|samuel|kings|chronicles|ezra|nehemiah|esther|job|psalms?|proverbs|ecclesiastes|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|corinthians|galatians|ephesians|philippians|colossians|thessalonians|timothy|titus|philemon|hebrews|james|peter|jude|revelation)\s+\d+/i.test(t),
    build: t => {
      const m = t.match(/((?:1|2|3)\s+)?([A-Za-z]+)\s+(\d+)(?::(\d+(?:-\d+)?))?/);
      const book = ((m?.[1] || '') + (m?.[2] || '')).trim();
      const chapter = Number(m?.[3] || 0);
      const verse = m?.[4] || '';
      const passage = `${book} ${chapter}${verse ? ':' + verse : ''}`;
      const observation = t.replace(m?.[0] || '', '').replace(/[?.!]+$/, '').trim();
      return { tool: 'create_verse_study', args: { passage, passageBook: book, passageChapter: chapter, observation }, confidence: 0.85 };
    },
  },
];

// ============================================================
// PUBLIC API
// ============================================================

export function classify(message) {
  const text = stripBoilerplate(String(message || ''));
  if (!text) return { intent: 'empty', confidence: 0 };

  for (const intent of INTENTS) {
    if (intent.test(text)) {
      const { tool, args, confidence } = intent.build(text);
      return { intent: intent.name, tool, args, confidence };
    }
  }

  if (/\?$/.test(text) && detectStores(text).length > 0) {
    return {
      intent: 'search_about',
      tool: 'search_entries',
      args: { query: text.replace(/[?.!]+$/g, '').trim(), stores: detectStores(text) },
      confidence: 0.5,
    };
  }

  return { intent: 'unsure', confidence: 0 };
}

// ============================================================
// RESPONSE TEMPLATES
// ============================================================

export function renderResponse(intent, args, result) {
  if (!result || result.error) {
    return result?.error ? `couldn't do that — ${result.error}` : `something went wrong. try a slash command.`;
  }

  switch (intent) {
    // -- read --
    case 'search_about': {
      const list = result.results || [];
      if (list.length === 0) return `nothing in your journal about "${esc(args.query)}". want me to capture it? type "idea: ${esc(args.query)}".`;
      const lines = list.slice(0, 8).map(r => {
        const id = (r.id || '').toString().slice(-6);
        const label = r.title || r.subject || r.passage || r.name || r.snippet || '(no title)';
        return `· ${r.store} · ${id} · ${esc(label).slice(0, 80)}`;
      });
      return `${list.length} match${list.length === 1 ? '' : 'es'}:\n${lines.join('\n')}`;
    }
    case 'recent': {
      const list = result.results || [];
      if (list.length === 0) return `no ${args.store} yet.`;
      const lines = list.map(r => {
        const label = r.title || r.subject || r.passage || r.snippet || r.name || JSON.stringify(r).slice(0, 60);
        return `· ${esc(label).slice(0, 80)}`;
      });
      return `recent ${args.store} (${list.length}):\n${lines.join('\n')}`;
    }
    case 'get_entry': {
      const e = result.entry || {};
      const id = (e.id || '').toString().slice(-6);
      const label = e.title || e.subject || e.passage || e.name || '(no title)';
      const meta = [
        e.priority && `· ${e.priority}`,
        e.scheduledFor && `· ${e.scheduledFor}`,
        e.completedAt && `· done ${e.completedAt.slice(0, 10)}`,
        e.venture && `· ${e.venture}`,
        e.status && `· ${e.status}`,
      ].filter(Boolean).join(' ');
      return `${result.store} · ${id} · ${esc(label)} ${meta}\n${esc(e.body || e.observation || e.note || '').slice(0, 300)}`;
    }
    case 'count_entries':
      return `${result.count} ${result.store} on file.`;
    case 'open_tasks': {
      const t = result.tasks || [];
      if (t.length === 0) return `no open tasks. inbox zero — rest in that.`;
      const lines = t.slice(0, 10).map(x => `· ${x.priority || 'P2'} · ${(x.id||'').slice(-6)} · ${esc(x.title)}${x.scheduledFor ? ' · ' + x.scheduledFor : ''}`);
      return `${t.length} open · top:\n${lines.join('\n')}`;
    }
    case 'open_prayers': {
      const p = result.prayers || [];
      if (p.length === 0) return `no active prayer subjects logged.`;
      const lines = p.slice(0, 10).map(x => `· !${x.intensity || 3} · ${(x.id||'').slice(-6)} · ${x.type || 'supplication'} · ${esc(x.subject)}`);
      return `${p.length} active:\n${lines.join('\n')}`;
    }
    case 'fti':
      return result.fresh
        ? `fti · 0 — nothing logged yet. start with /today, /task, or /pray.`
        : `fti · ${result.score}/100 · ${result.closedTasks || 0} of ${result.taskCount || 0} tasks closed.`;
    case 'profile': {
      const name = result.name || 'friend';
      const calling = result.calling || '(no calling set)';
      const verse = result.anchorVerse || '(no anchor verse)';
      return `${name} · "${calling}" · anchor: ${verse}`;
    }

    // -- summaries --
    case 'summarize_week':
    case 'summarize_month': {
      const lines = [
        `${result.period} · ${result.from} → ${result.to}`,
        `· ${result.tasksCompleted} tasks closed of ${result.tasksTouched}`,
        `· ${result.ideasCaptured} ideas · ${result.prayersLogged} prayers (${result.prayersAnswered} answered)`,
        `· ${result.bibleStudies} bible · ${result.testimonies} testimonies · ${result.journalEntries} journal entries`,
        `· money: in GHS ${result.income} · out GHS ${result.spend} · net GHS ${result.net}`,
      ];
      return lines.join('\n');
    }
    case 'summarize_finances': {
      const cats = (result.topCategories || []).map(c => `  · ${c.category}: GHS ${c.amount}`).join('\n');
      const vens = (result.byVenture || []).slice(0, 4).map(v => `  · ${v.venture}: GHS ${v.amount}`).join('\n');
      return [
        `finances · ${result.period} · ${result.from} → ${result.to}`,
        `income GHS ${result.income} · spend GHS ${result.spend} · net GHS ${result.net}`,
        `${result.transactionCount} transactions · expected tithe GHS ${result.expectedTithe}`,
        cats ? `\ntop categories:\n${cats}` : '',
        vens ? `\nby venture:\n${vens}` : '',
      ].filter(Boolean).join('\n');
    }
    case 'summarize_venture': {
      const tasks = (result.tasks || []).map(t => `  · ${t.priority || 'P2'} · ${esc(t.title)}`).join('\n');
      return [
        `${result.venture} · ${result.activeProjects} active project${result.activeProjects === 1 ? '' : 's'} · ${result.openTasks} open task${result.openTasks === 1 ? '' : 's'}`,
        `money: in GHS ${result.income} · out GHS ${result.spend} · net GHS ${result.net}`,
        tasks ? `\nnext up:\n${tasks}` : '',
      ].filter(Boolean).join('\n');
    }

    // -- create --
    case 'create_task':
      return `task · ${(result.id || '').toString().slice(-6)} · ${result.priority} · ${esc(result.title)} · ${result.scheduledFor}`;
    case 'create_idea':
      return `idea · ${(result.id || '').toString().slice(-6)} · ${esc(result.title)}`;
    case 'create_prayer':
      return `prayer · ${(result.id || '').toString().slice(-6)} · ${result.type} · !${result.intensity} · ${esc(result.subject)}`;
    case 'create_testimony':
      return `testimony · ${(result.id || '').toString().slice(-6)} · ${esc(result.title)}`;
    case 'create_dream':
      return `dream · ${(result.id || '').toString().slice(-6)} · ${result.type}`;
    case 'create_prophecy':
      return `prophecy · ${(result.id || '').toString().slice(-6)} · ${result.platform} · ${esc(result.word || '').slice(0, 80)}${result.speaker ? ' — from ' + esc(result.speaker) : ''}`;
    case 'fulfill_prophecy':
      return `fulfilled · ${(result.id || '').toString().slice(-6)} · ${result.fulfilledOn} · ${esc(result.word || '').slice(0, 80)}`;
    case 'create_verse_study':
      return `verse · ${(result.id || '').toString().slice(-6)} · ${esc(result.passage)}`;
    case 'create_journal':
      return `journal · ${result.id} · mood ${result.mood} · ${esc(result.oneSentence)}`;
    case 'create_blog':
      return `blog · ${(result.id || '').toString().slice(-6)} · ${result.status} · ${esc(result.title)}`;
    case 'create_project':
      return `project · ${(result.id || '').toString().slice(-6)} · ${result.venture} · ${result.phase} · ${esc(result.title)}`;
    case 'create_plan':
      return `plan · ${(result.id || '').toString().slice(-6)} · ${result.venture} · ${result.phase} · ${esc(result.title)}`;
    case 'create_person':
      return `contact · ${(result.id || '').toString().slice(-6)} · ${esc(result.name)}`;
    case 'create_book':
      return `book · ${(result.id || '').toString().slice(-6)} · ${result.status} · ${esc(result.title)}`;
    case 'create_event':
      return `event · ${(result.id || '').toString().slice(-6)} · ${esc(result.title)} · ${result.startAt}`;
    case 'start_fast':
      return `fast started · ${(result.id || '').toString().slice(-6)} · ${result.type} · ${result.plannedHours}h planned`;
    case 'log_meal':
      return `meal · ${(result.id || '').toString().slice(-6)} · ${result.slot} · ${esc(result.items).slice(0, 80)}`;
    case 'log_transaction': {
      const sign = result.direction === 'out' ? '−' : '+';
      return `${result.direction === 'out' ? 'spend' : 'income'} · ${(result.id || '').toString().slice(-6)} · ${sign}GHS ${result.amount} · ${result.category} · ${result.venture}`;
    }

    // -- update / lifecycle --
    case 'complete_task':
      return `done · ${(result.id || '').toString().slice(-6)} · ${esc(result.title)} · closed`;
    case 'reopen_task':
      return `reopened · ${(result.id || '').toString().slice(-6)} · ${esc(result.title)}`;
    case 'update_task': {
      const fields = Object.entries(args.patch || {}).map(([k, v]) => `${k}: ${v}`).join(' · ');
      return `updated · ${(result.id || '').toString().slice(-6)} · ${fields}`;
    }
    case 'update_idea':
    case 'update_prayer':
    case 'update_dream':
    case 'update_project':
    case 'update_book': {
      const fields = Object.entries(args.patch || {}).map(([k, v]) => `${k}: ${v}`).join(' · ');
      return `updated · ${result.store} · ${(result.id || '').toString().slice(-6)} · ${fields}`;
    }
    case 'answer_prayer':
      return `prayer answered · ${(result.id || '').toString().slice(-6)} · ${esc(result.subject)} · ${result.answeredOn}`;
    case 'end_fast':
      return `fast ended · ${(result.id || '').toString().slice(-6)} · ${result.endedAt.slice(0, 16).replace('T', ' ')}`;
    case 'delete_entry':
      return `removed · ${result.store} · ${(result.id || '').toString().slice(-6)}`;

    default:
      return `done.`;
  }
}

function esc(s) {
  return String(s || '').replace(/[<>]/g, c => ({ '<': '&lt;', '>': '&gt;' }[c]));
}
