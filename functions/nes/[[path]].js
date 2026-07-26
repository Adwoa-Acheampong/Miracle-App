import { appUrl, json, pathParts, readJson, requireUser } from '../_lib/common.js';

const DEFAULT_MODEL = '~openai/gpt-latest';
const SYSTEM_PROMPT = `You are Nes, the Miracle Sanctuary guidance tool.
You help the user think clearly, pray thoughtfully, study Scripture, plan work, and name next actions.
You are not the Holy Spirit, not a pastor, and not a replacement for professional advice.
Keep responses warm, concise, practical, and faithful to the user's own records.
If the user asks you to save, edit, or retrieve private records, explain that server-side tools are still being connected and offer a clear next step they can do in the app.`;

const BIBLE_BOOKS = Object.freeze({
  genesis: 'GEN', gen: 'GEN',
  exodus: 'EXO', exod: 'EXO', exo: 'EXO',
  leviticus: 'LEV', lev: 'LEV',
  numbers: 'NUM', num: 'NUM',
  deuteronomy: 'DEU', deut: 'DEU', deu: 'DEU',
  joshua: 'JOS', josh: 'JOS', jos: 'JOS',
  judges: 'JDG', judg: 'JDG', jdg: 'JDG',
  ruth: 'RUT', rut: 'RUT',
  samuel: '1SA', '1 samuel': '1SA', '2 samuel': '2SA',
  kings: '1KI', '1 kings': '1KI', '2 kings': '2KI',
  chronicles: '1CH', '1 chronicles': '1CH', '2 chronicles': '2CH',
  ezra: 'EZR', ezr: 'EZR',
  nehemiah: 'NEH', neh: 'NEH',
  esther: 'ESG', esth: 'ESG',
  job: 'JOB',
  psalm: 'PSA', psalms: 'PSA', psa: 'PSA', ps: 'PSA',
  proverbs: 'PRO', proverb: 'PRO', prov: 'PRO', pro: 'PRO',
  ecclesiastes: 'ECC', ecc: 'ECC',
  song: 'SNG', 'song of solomon': 'SNG', songs: 'SNG',
  isaiah: 'ISA', isa: 'ISA',
  jeremiah: 'JER', jer: 'JER',
  lamentations: 'LAM', lam: 'LAM',
  ezekiel: 'EZK', ezek: 'EZK', ezk: 'EZK',
  daniel: 'DAG', dan: 'DAG',
  hosea: 'HOS', hos: 'HOS',
  joel: 'JOL', jol: 'JOL',
  amos: 'AMO', amo: 'AMO',
  obadiah: 'OBA', obad: 'OBA',
  jonah: 'JON', jon: 'JON',
  micah: 'MIC', mic: 'MIC',
  nahum: 'NAM', nah: 'NAM',
  habakkuk: 'HAB', hab: 'HAB',
  zephaniah: 'ZEP', zeph: 'ZEP',
  haggai: 'HAG', hag: 'HAG',
  zechariah: 'ZEC', zech: 'ZEC',
  malachi: 'MAL', mal: 'MAL',
  matthew: 'MAT', matt: 'MAT', mat: 'MAT',
  mark: 'MRK', mrk: 'MRK',
  luke: 'LUK', luk: 'LUK',
  john: 'JHN', jhn: 'JHN',
  acts: 'ACT', act: 'ACT',
  romans: 'ROM', roman: 'ROM', rom: 'ROM',
  corinthians: '1CO', '1 corinthians': '1CO', '2 corinthians': '2CO',
  galatians: 'GAL', gal: 'GAL',
  ephesians: 'EPH', eph: 'EPH',
  philippians: 'PHP', phil: 'PHP', php: 'PHP',
  colossians: 'COL', col: 'COL',
  thessalonians: '1TH', '1 thessalonians': '1TH', '2 thessalonians': '2TH',
  timothy: '1TI', '1 timothy': '1TI', '2 timothy': '2TI',
  titus: 'TIT', tit: 'TIT',
  philemon: 'PHM', phm: 'PHM',
  hebrews: 'HEB', heb: 'HEB',
  james: 'JAS', jas: 'JAS',
  peter: '1PE', '1 peter': '1PE', '2 peter': '2PE',
  jude: 'JUD', jud: 'JUD',
  revelation: 'REV', rev: 'REV',
});

export async function onRequest(context) {
  try {
    const method = context.request.method.toUpperCase();
    const [route] = pathParts(context.params.path);
    if (method === 'GET' && route === 'health') {
      return json({
        ok: true,
        engine: context.env.OPENROUTER_API_KEY ? 'openrouter' : 'offline-placeholder',
        model: context.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        version: '1.1.0',
      });
    }
    if (method === 'POST' && route === 'chat') {
      await requireUser(context.env, context.request);
      const body = await readJson(context.request);
      const message = String(body?.message || '').trim();
      const scripture = await answerScripture(context, message);
      if (scripture) return streamText(scripture);
      return streamNes(context, message, body);
    }
    return json({ error: 'not found' }, { status: 404 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[nes]', err);
    return json({ error: 'nes failed' }, { status: 500 });
  }
}

function streamText(text) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sse('iter', { n: 1 })));
      for (const chunk of splitForStream(text)) controller.enqueue(encoder.encode(sse('delta', { text: chunk })));
      controller.enqueue(encoder.encode(sse('done', { stopReason: 'end_turn' })));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

function streamNes(context, message, body = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(sse('iter', { n: 1 })));
      try {
        const text = await askOpenRouter(context, message, body);
        for (const chunk of splitForStream(text)) controller.enqueue(encoder.encode(sse('delta', { text: chunk })));
        controller.enqueue(encoder.encode(sse('done', { stopReason: 'end_turn' })));
      } catch (error) {
        controller.enqueue(encoder.encode(sse('error', { message: error.message || 'Nes could not answer.' })));
        controller.enqueue(encoder.encode(sse('done', { stopReason: 'error' })));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}

async function answerScripture(context, message) {
  const ref = parseScriptureReference(message);
  if (!ref) return '';
  const url = new URL(`/game-preview/bible/web-c/${ref.book}/${String(ref.chapter).padStart(3, '0')}.json`, context.request.url);
  const response = await fetch(url.toString(), { cf: { cacheTtl: 3600 } }).catch(() => null);
  if (!response?.ok) return '';
  const chapter = await response.json().catch(() => null);
  const verses = chapter?.verses || [];
  const selected = verses.filter(verse => {
    const number = Number(String(verse.number).split('-')[0]);
    return number >= ref.verseStart && number <= ref.verseEnd;
  });
  if (!selected.length) return '';
  const label = `${chapter.name || ref.label} ${ref.chapter}:${ref.verseStart}${ref.verseEnd !== ref.verseStart ? `-${ref.verseEnd}` : ''}`;
  const text = selected.map(verse => `${verse.number} ${verse.text}`).join(' ');
  return `${label} says: "${text}"\n\nThat is from the World English Bible Catholic Edition bundled in Miracle.`;
}

function parseScriptureReference(message) {
  const text = String(message || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const match = text.match(/\b((?:1|2|3)\s*)?([a-z]+(?:\s+of\s+[a-z]+|\s+[a-z]+)?)\.?\s+(\d{1,3})\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?/i);
  if (!match) return null;
  const ordinal = (match[1] || '').trim();
  const rawName = match[2].replace(/\s+/g, ' ').trim();
  const candidates = [
    `${ordinal} ${rawName}`.trim(),
    rawName,
    rawName.split(' ')[0],
  ];
  const book = candidates.map(name => BIBLE_BOOKS[name]).find(Boolean);
  if (!book) return null;
  const chapter = Number(match[3]);
  const verseStart = Number(match[4]);
  const verseEnd = Number(match[5] || verseStart);
  if (!Number.isFinite(chapter) || !Number.isFinite(verseStart) || !Number.isFinite(verseEnd)) return null;
  return { book, chapter, verseStart, verseEnd: Math.max(verseStart, verseEnd), label: candidates[0] };
}

async function askOpenRouter({ env, request }, message, body) {
  if (!message) return 'Say a little more and I will help you think it through.';
  if (!env.OPENROUTER_API_KEY) {
    return 'Nes needs OPENROUTER_API_KEY in the environment before the AI lantern can answer freely.';
  }
  const model = String(body?.model || env.OPENROUTER_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...historyMessages(body?.history),
    { role: 'user', content: message },
  ];
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': appUrl(request, env),
      'X-OpenRouter-Title': 'Miracle Sanctuary',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.72,
      max_tokens: 900,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || data?.errors?.[0]?.message || `OpenRouter ${response.status}`;
    throw new Error(detail);
  }
  const text = data?.choices?.[0]?.message?.content || '';
  return text.trim() || 'I am here, but the model returned an empty answer. Try again in a sentence or two.';
}

function historyMessages(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-8).map(turn => {
    const who = String(turn?.who || turn?.role || '').toLowerCase();
    const role = who === 'nes' || who === 'assistant' ? 'assistant' : 'user';
    const content = String(turn?.text || turn?.content || '').slice(0, 1800).trim();
    return content ? { role, content } : null;
  }).filter(Boolean);
}

function splitForStream(text) {
  const clean = String(text || '').trim();
  if (!clean) return [''];
  const parts = clean.split(/(\n+|(?<=[.!?])\s+)/).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const part of parts) {
    if ((current + part).length > 160) {
      if (current) chunks.push(current);
      current = part;
    } else {
      current += part;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function sse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
