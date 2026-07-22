import { json, pathParts, readJson, requireUser } from '../_lib/common.js';

export async function onRequest(context) {
  try {
    const method = context.request.method.toUpperCase();
    const [route] = pathParts(context.params.path);
    if (method === 'GET' && route === 'health') {
      return json({ ok: true, engine: 'cloudflare-placeholder', version: '1.0.0' });
    }
    if (method === 'POST' && route === 'chat') {
      await requireUser(context.env, context.request);
      const body = await readJson(context.request);
      const message = String(body?.message || '').trim();
      return streamNes(message);
    }
    return json({ error: 'not found' }, { status: 404 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error('[nes]', err);
    return json({ error: 'nes failed' }, { status: 500 });
  }
}

function streamNes(message) {
  const encoder = new TextEncoder();
  const text = message
    ? 'Nes is online on Cloudflare. Slash commands still run locally; server-side free-form tools will be reconnected after the D1 move.'
    : 'Say a little more and I will help you capture it.';
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sse('iter', { n: 1 })));
      controller.enqueue(encoder.encode(sse('delta', { text })));
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

function sse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
