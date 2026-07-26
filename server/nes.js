// nes.js — Standalone rule-based Nes agent. No external LLM API required.
// Pipeline: classify(message) → executeTool(name, args, userId) → renderResponse() → SSE stream

import express from 'express';
import { requireAuth } from './auth.js';
import { executeTool } from './nes-tools.js';
import { classify, renderResponse } from './nes-nlu.js';
import { one } from './db.js';

export const nes = express.Router();

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || '~openai/gpt-latest';
const OPENROUTER_REFERER = process.env.APP_URL || 'https://miracle-app.pages.dev';
const NES_SYSTEM_PROMPT = `You are Nes, the Miracle Sanctuary guidance tool.
You help the user think clearly, pray thoughtfully, study Scripture, plan work, and name next actions.
You are not the Holy Spirit, not a pastor, and not a replacement for professional advice.
Keep responses warm, concise, practical, and faithful to the user's own records.
If a tool action is needed, tell the user the exact place in the app to save or update it.`;

// ============================================================
// POST /nes/chat  body: { message, history? }
// ============================================================
nes.post('/chat', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { message, history, model } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  // ── SSE setup ──────────────────────────────────────────────
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if proxied
  res.flushHeaders?.();

  const send = (event, data) => {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
    catch { /* client disconnected */ }
  };

  try {
    // ── 1. Show "thinking" tick ─────────────────────────────
    send('iter', { n: 1 });

    // ── 2. Classify intent ──────────────────────────────────
    const { intent, tool, args, confidence } = classify(message);

    if (OPENROUTER_KEY && (confidence < 0.4 || intent === 'unsure' || intent === 'empty')) {
      const text = await askOpenRouter({ message, history, model });
      for (const chunk of splitForStream(text)) send('delta', { text: chunk });
      send('done', { stopReason: 'end_turn' });
      return;
    }

    if (confidence < 0.4 || intent === 'unsure' || intent === 'empty') {
      const fb = OPENROUTER_KEY ? pickFallback(message) : `${pickFallback(message)}\n\nTo enable free-form Nes, set OPENROUTER_API_KEY on the server.`;
      send('delta', { text: fb });
      send('done',  { stopReason: 'unsure' });
      return;
    }

    // ── 3. Execute the matched tool ─────────────────────────
    send('tool_call', { name: tool, input: args });
    let result;
    try {
      result = await executeTool(tool, args || {}, userId);
    } catch (e) {
      result = { error: String(e?.message || e) };
    }
    send('tool_result', { name: tool, result });

    // ── 4. Load user profile for response personalisation ───
    const profile = await one(
      `SELECT name, calling, anchor_verse AS anchorVerse FROM users WHERE id = ?`,
      [userId],
    ).catch(() => null);

    // ── 5. Render response and stream it ────────────────────
    const text = renderResponse(intent, args, result, profile);
    for (const chunk of splitForStream(text)) {
      send('delta', { text: chunk });
    }
    send('done', { stopReason: 'end_turn' });

  } catch (err) {
    console.error('[nes] chat error', err);
    send('error', { message: String(err?.message || err) });
  } finally {
    res.end();
  }
});

// ============================================================
// GET /nes/health — quick health probe
// ============================================================
nes.get('/health', (_req, res) => {
  res.json({ ok: true, engine: OPENROUTER_KEY ? 'rule-based-nlu+openrouter' : 'rule-based-nlu', model: OPENROUTER_MODEL, version: '1.1.0' });
});

// ============================================================
// Helpers
// ============================================================

const FALLBACKS = [
  "not sure what you mean. try a slash command — type /help for the full list.",
  "didn't catch that. quick options: /task, /idea, /pray, /today, /dream, /spend, /income, /search.",
  "can you rephrase? for tasks say 'remind me to…', for money say 'spent GHS 40 on fuel'.",
  "unclear — what are you trying to capture or find?",
  "not following. try: 'my open tasks', 'recent ideas', 'pray for …', or 'fti'.",
];
let _fbIdx = 0;
function pickFallback() {
  return FALLBACKS[_fbIdx++ % FALLBACKS.length];
}

async function askOpenRouter({ message, history = [], model }) {
  const messages = [
    { role: 'system', content: NES_SYSTEM_PROMPT },
    ...historyMessages(history),
    { role: 'user', content: message },
  ];
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': OPENROUTER_REFERER,
      'X-OpenRouter-Title': 'Miracle Sanctuary',
    },
    body: JSON.stringify({
      model: String(model || OPENROUTER_MODEL || '~openai/gpt-latest'),
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
  return String(data?.choices?.[0]?.message?.content || '').trim() || 'Nes heard you, but the model returned an empty answer. Try again in a sentence or two.';
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

// Split response text at natural boundaries so the UI gets incremental updates.
// Lines that start with · (bullet) are sent one at a time for a list feel.
function splitForStream(text) {
  if (!text) return [''];
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    // First line (summary) or short line — send as one chunk
    if (i === 0 || !line.startsWith('·')) {
      out.push(i === 0 ? line : '\n' + line);
    } else {
      // Each bullet on its own delta gives the list a staggered feel
      out.push('\n' + line);
    }
  }
  return out.length ? out : [text];
}
