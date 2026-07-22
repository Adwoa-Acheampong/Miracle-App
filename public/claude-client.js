// claude-client.js — Optional Claude API integration for Nes.
// Activates when user provides an Anthropic API key via /settings.
// Falls back silently to local parser when not configured.

import { get, put } from './store.js';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-opus-4-7';

export async function loadClaudeConfig() {
  const row = await get('meta', 'claude');
  return row?.value || { apiKey: '', model: DEFAULT_MODEL, enabled: false };
}

export async function saveClaudeConfig(cfg) {
  await put('meta', { key: 'claude', value: cfg });
}

// Send a user message + optional context to Claude.
// Returns { text, raw } or throws.
export async function askClaude(prompt, { system, maxTokens = 800, context } = {}) {
  const cfg = await loadClaudeConfig();
  if (!cfg.enabled || !cfg.apiKey) {
    throw new Error('claude not configured · open settings → claude');
  }

  const userBlock = context
    ? `Context (read-only, from my journal):\n${context}\n\n---\n\n${prompt}`
    : prompt;

  const sys = system || defaultSystemPrompt();

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: cfg.model || DEFAULT_MODEL,
      max_tokens: maxTokens,
      system: sys,
      messages: [{ role: 'user', content: userBlock }],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`claude api error ${res.status} · ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.content || []).map(c => c.text || '').join('').trim();
  return { text, raw: data };
}

export function defaultSystemPrompt() {
  return [
    'You are Nes, an assistant inside MIRACLE — a personal cognitive system for Adwoa, a faith-driven multi-venture operator in Ghana.',
    'Tone: terse, lowercase, no emojis, no fluff. Anchor in scripture when natural. Honor the Holy Spirit — never confuse Nes with the Spirit.',
    'When asked to draft entries, structure them as compact JSON or short markdown blocks the user can paste back.',
    'When asked questions, answer in 2-5 sentences max unless asked for more.',
    'Tewahedo Bible canon is respected (OT 39 + NT 27 + Deuterocanon + Tewahedo extras).',
  ].join(' ');
}
