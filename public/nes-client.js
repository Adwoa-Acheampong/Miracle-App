// nes-client.js — Frontend client for the /nes/chat SSE agent.
// Streams text deltas + tool-call events back to the Nes panel.

import { getApiBase, getToken } from './auth.js';

const HISTORY_KEY = 'nes_chat_history';

export function loadHistory() {
  try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]'); }
  catch { return []; }
}

export function saveHistory(history) {
  try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-24))); }
  catch {}
}

export function clearHistory() {
  try { sessionStorage.removeItem(HISTORY_KEY); } catch {}
}

/**
 * Stream a chat turn. Returns a Promise<string> with the full assistant text.
 * Calls handlers as events arrive:
 *   onDelta(textChunk)     — append text to the live bubble
 *   onToolCall({name,input})  — show "→ {name}…"
 *   onToolResult({name,result}) — update the indicator
 *   onIter({n})            — show a subtle "thinking 2/6" tick
 *   onDone({stopReason})   — final state
 *   onError({message})
 */
export async function streamChat(message, { history = [], model, onDelta, onToolCall, onToolResult, onIter, onDone, onError } = {}) {
  const token = getToken();
  if (!token) throw new Error('not authenticated · log in first');

  const url = `${getApiBase()}/nes/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'text/event-stream',
    },
    body: JSON.stringify({ message, history, model }),
  });

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch {}
    throw new Error(`nes ${res.status} · ${body.slice(0, 200)}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full   = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Split on SSE event boundaries (\n\n)
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const ev = parseEvent(chunk);
      if (!ev) continue;
      try {
        if (ev.event === 'delta')        { full += ev.data.text || ''; onDelta?.(ev.data.text || ''); }
        else if (ev.event === 'tool_call')   onToolCall?.(ev.data);
        else if (ev.event === 'tool_result') onToolResult?.(ev.data);
        else if (ev.event === 'iter')        onIter?.(ev.data);
        else if (ev.event === 'done')        onDone?.(ev.data);
        else if (ev.event === 'error')       onError?.(ev.data);
      } catch (e) {
        console.warn('nes event handler error', e);
      }
    }
  }
  return full;
}

function parseEvent(chunk) {
  const lines = chunk.split('\n');
  let event = 'message', data = '';
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return null;
  try { return { event, data: JSON.parse(data) }; }
  catch { return { event, data: { raw: data } }; }
}
