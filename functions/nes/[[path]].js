import { appUrl, json, pathParts, readJson, requireUser } from '../_lib/common.js';

const DEFAULT_MODEL = '~openai/gpt-latest';
const SYSTEM_PROMPT = `You are Nes, the Miracle Sanctuary guidance tool.
You help the user think clearly, pray thoughtfully, study Scripture, plan work, and name next actions.
You are not the Holy Spirit, not a pastor, and not a replacement for professional advice.
Keep responses warm, concise, practical, and faithful to the user's own records.
If the user asks you to save, edit, or retrieve private records, explain that server-side tools are still being connected and offer a clear next step they can do in the app.`;

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
      return streamNes(context, message, body);
    }
    return json({ error: 'not found' }, { status: 404 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[nes]', err);
    return json({ error: 'nes failed' }, { status: 500 });
  }
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
