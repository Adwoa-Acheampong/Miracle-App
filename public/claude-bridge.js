// claude-bridge.js — Talk to Claude Desktop via the existing filesystem MCP bridge.
// Uses your chat plan (no API key). Writes request files into the synced folder;
// polls for reply files Claude writes back.

import { verifyPermission, isConnected } from './bridge.js';

// Re-use the dirHandle held inside bridge.js by reading it lazily through a getter.
// bridge.js doesn't export the handle, so we route everything through its public
// directory helpers via a small wrapper.

async function getDir(subpath) {
  const { getDirHandle } = await import('./bridge.js').then(m => {
    return { getDirHandle: m._getDirHandle || null };
  });
  if (!getDirHandle) {
    // Fallback: piggy-back on verifyPermission then access through the same module
    if (!isConnected()) throw new Error('bridge not connected · /settings → claude desktop bridge');
    if (!(await verifyPermission())) throw new Error('permission denied');
    // We need direct access to dirHandle — expose via a tiny patch below.
  }
  return getDirHandle ? getDirHandle(subpath) : null;
}

// Because bridge.js keeps dirHandle private, we add a helper to it via dynamic call.
// To keep this file self-contained, we re-implement the small bits we need.

let _bridgeRef = null;
async function bridge() {
  if (_bridgeRef) return _bridgeRef;
  _bridgeRef = await import('./bridge.js');
  return _bridgeRef;
}

async function getDirHandle(name) {
  const b = await bridge();
  if (!b.isConnected()) throw new Error('bridge not connected · /settings → claude desktop bridge');
  if (!(await b.verifyPermission())) throw new Error('permission denied');
  // Access dirHandle indirectly: the only public way is via existing helpers.
  // Use checkInbox / exportAll style — but those don't return the handle.
  // We expose it by reading through the meta-stored handle path indirectly.
  // Simpler: read the live handle from store and re-walk subdir.
  const { get } = await import('./store.js');
  const meta = await get('meta', 'bridge.dirHandle');
  const root = meta?.value;
  if (!root) throw new Error('bridge handle missing — reconnect in settings');
  if ((await root.queryPermission({ mode: 'readwrite' })) !== 'granted') {
    await root.requestPermission({ mode: 'readwrite' });
  }
  return root.getDirectoryHandle(name, { create: true });
}

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function corrId() {
  return ts() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Write a question file Claude will see in the bridged folder.
// Returns the correlation id so caller can poll for the reply.
export async function askViaBridge(prompt, { kind = 'ask', system, context, model } = {}) {
  const id = corrId();
  const asksDir = await getDirHandle('asks');
  const fname = `${id}.json`;
  const payload = {
    kind: 'ask-request',
    correlationId: id,
    requestedAt: new Date().toISOString(),
    intent: kind, // 'ask' | 'draft'
    model: model || 'opus',
    system: system || defaultSystemPrompt(),
    prompt,
    context: context || null,
    instructions: `Reply by writing inbox/${id}-reply.json with shape:
{
  "kind": "ask-reply",
  "correlationId": "${id}",
  "answeredAt": "<ISO>",
  "text": "<your response in nes' voice>"
}
Once written, this app will pick it up and display in Nes.`,
  };
  const fh = await asksDir.getFileHandle(fname, { create: true });
  const w = await fh.createWritable();
  await w.write(JSON.stringify(payload, null, 2));
  await w.close();
  return id;
}

// Poll the inbox for a reply file matching this correlation id.
// Resolves with reply text or rejects after timeout.
export async function pollForReply(correlationId, { timeoutMs = 120000, intervalMs = 1500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = await findReply(correlationId);
    if (found) return found;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`timed out waiting for claude (${Math.round(timeoutMs / 1000)}s) — is claude desktop watching the bridge?`);
}

async function findReply(correlationId) {
  let inbox;
  try { inbox = await getDirHandle('inbox'); } catch { return null; }
  const want = `${correlationId}-reply.json`;
  for await (const [name, entry] of inbox.entries()) {
    if (entry.kind !== 'file') continue;
    if (name !== want && !name.endsWith(`${correlationId}.json`) && !name.includes(correlationId)) continue;
    try {
      const file = await entry.getFile();
      const data = JSON.parse(await file.text());
      if (data.correlationId !== correlationId) continue;
      // Move to processed/ so it doesn't get re-applied by /sync inbox
      await moveToProcessed(name, file);
      return data.text || data.body || '';
    } catch { /* skip */ }
  }
  return null;
}

async function moveToProcessed(name, file) {
  try {
    const inbox = await getDirHandle('inbox');
    const processed = await getDirHandle('processed');
    const text = await file.text();
    const target = await processed.getFileHandle(name, { create: true });
    const w = await target.createWritable();
    await w.write(text);
    await w.close();
    await inbox.removeEntry(name);
  } catch { /* ignore */ }
}

export function defaultSystemPrompt() {
  return [
    'You are Nes, an assistant inside MIRACLE — a personal cognitive system for Adwoa,',
    'a faith-driven multi-venture operator in Ghana.',
    'Tone: terse, lowercase, no emojis, no fluff. Anchor in scripture when natural.',
    'Honor the Holy Spirit — never confuse Nes with the Spirit.',
    'When asked questions, answer in 2-5 sentences max unless asked for more.',
    'Tewahedo Bible canon is respected (OT 39 + NT 27 + Deuterocanon + Tewahedo extras).',
  ].join(' ');
}
