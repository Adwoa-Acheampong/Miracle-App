// nes.js — Standalone rule-based Nes agent. No external LLM API required.
// Pipeline: classify(message) → executeTool(name, args, userId) → renderResponse() → SSE stream

import express from 'express';
import { requireAuth } from './auth.js';
import { executeTool } from './nes-tools.js';
import { classify, renderResponse } from './nes-nlu.js';
import { one } from './db.js';

export const nes = express.Router();

// ============================================================
// POST /nes/chat  body: { message, history? }
// ============================================================
nes.post('/chat', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { message } = req.body || {};

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

    if (confidence < 0.4 || intent === 'unsure' || intent === 'empty') {
      const fb = pickFallback(message);
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
  res.json({ ok: true, engine: 'rule-based-nlu', version: '1.0.0' });
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
