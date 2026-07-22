// Bridge to Claude Desktop via filesystem MCP.
// Uses File System Access API to manage a sync folder.

import { all, put, ulid, get as storeGet } from './store.js';

const HANDLE_KEY = 'bridge.dirHandle';
const STORE_NAMES = [
  'daily','dreams','ideas','bible','prayers','fasts',
  'plans','projects','tasks','events','meals','transactions','budgets',
  'blogs','books','quizzes','tags','meta',
];

let dirHandle = null;

export async function loadHandle() {
  const meta = await storeGet('meta', HANDLE_KEY);
  if (meta && meta.value) dirHandle = meta.value;
  return dirHandle;
}

export async function connect() {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('File System Access API not supported. Use Chrome/Edge.');
  }
  const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
  dirHandle = handle;
  await put('meta', { key: HANDLE_KEY, value: handle });
  await ensureSubdirs();
  await writeInstructions();
  return handle.name;
}

export function isConnected() { return !!dirHandle; }

export async function verifyPermission() {
  if (!dirHandle) return false;
  const opts = { mode: 'readwrite' };
  if ((await dirHandle.queryPermission(opts)) === 'granted') return true;
  return (await dirHandle.requestPermission(opts)) === 'granted';
}

export async function exportAll() {
  if (!(await verifyPermission())) throw new Error('permission denied');
  const stateDir = await dirHandle.getDirectoryHandle('state', { create: true });
  const exportedAt = new Date().toISOString();
  const summary = { exportedAt, counts: {} };

  for (const name of STORE_NAMES) {
    try {
      const rows = await all(name);
      summary.counts[name] = rows.length;
      await writeJSON(stateDir, `${name}.json`, { store: name, exportedAt, rows });
    } catch (e) { /* store may not exist yet */ }
  }
  await writeJSON(stateDir, '_summary.json', summary);
  return summary;
}

export async function checkInbox() {
  if (!(await verifyPermission())) throw new Error('permission denied');
  const inbox = await dirHandle.getDirectoryHandle('inbox', { create: true });
  const items = [];
  for await (const [name, entry] of inbox.entries()) {
    if (entry.kind !== 'file' || !name.endsWith('.json')) continue;
    try {
      const file = await entry.getFile();
      const text = await file.text();
      const data = JSON.parse(text);
      items.push({ name, data, size: file.size });
    } catch (e) {
      items.push({ name, error: e.message });
    }
  }
  return items;
}

export async function applyInboxFile(name) {
  if (!(await verifyPermission())) throw new Error('permission denied');
  const inbox     = await dirHandle.getDirectoryHandle('inbox',     { create: true });
  const processed = await dirHandle.getDirectoryHandle('processed', { create: true });
  const fileHandle = await inbox.getFileHandle(name);
  const file = await fileHandle.getFile();
  const data = JSON.parse(await file.text());

  let applied = 0;
  if (Array.isArray(data.ops)) {
    for (const op of data.ops) {
      if (op.op === 'create' || op.op === 'update') {
        const value = { ...op.value };
        if (!value.id) value.id = ulid();
        await put(op.store, value);
        applied++;
      }
    }
  } else if (data.store && data.value) {
    const value = { ...data.value };
    if (!value.id) value.id = ulid();
    await put(data.store, value);
    applied = 1;
  } else if (data.store && Array.isArray(data.values)) {
    for (const v of data.values) {
      const value = { ...v };
      if (!value.id) value.id = ulid();
      await put(data.store, value);
      applied++;
    }
  }

  // Move file to processed/
  const target = await processed.getFileHandle(name, { create: true });
  const w = await target.createWritable();
  await w.write(await file.text());
  await w.close();
  await inbox.removeEntry(name);

  return { applied, name };
}

async function ensureSubdirs() {
  for (const sub of ['state', 'inbox', 'processed', 'outbox', 'published', 'asks']) {
    await dirHandle.getDirectoryHandle(sub, { create: true });
  }
}

export async function queueForPublish(blogId, variantId) {
  if (!(await verifyPermission())) throw new Error('permission denied');
  const blog = await storeGet('blogs', blogId);
  if (!blog) throw new Error('blog not found');
  const variant = (blog.variants || []).find(v => v.id === variantId);
  if (!variant) throw new Error('variant not found');
  if (variant.status !== 'approved') throw new Error('variant must be approved first');

  const outboxRoot   = await dirHandle.getDirectoryHandle('outbox', { create: true });
  const platformDir  = await outboxRoot.getDirectoryHandle(variant.platform, { create: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fname = `${stamp}-${blog.id.slice(-6)}-${variant.id}.json`;
  const payload = {
    kind: 'publish-request',
    platform: variant.platform,
    blogId: blog.id,
    variantId: variant.id,
    title: blog.title,
    body: variant.body,
    hashtags: variant.hashtags,
    media: variant.media || [],
    requestedAt: new Date().toISOString(),
    instructions: `Publish to ${variant.platform}. After posting, write to inbox/{ts}-publish-result.json with: { ops: [{ op: 'update', store: 'blogs', value: { id: '${blog.id}', variants: [<all variants with this one's status=published, externalId, externalUrl, publishedAt set>] } }] }`,
  };
  const f = await platformDir.getFileHandle(fname, { create: true });
  const w = await f.createWritable();
  await w.write(JSON.stringify(payload, null, 2));
  await w.close();

  variant.status = 'queued';
  variant.scheduledFor = new Date().toISOString();
  await put('blogs', blog);

  return { file: fname, platform: variant.platform };
}

export async function listOutbox() {
  if (!(await verifyPermission())) throw new Error('permission denied');
  const outboxRoot = await dirHandle.getDirectoryHandle('outbox', { create: true });
  const items = [];
  for await (const [platName, platDir] of outboxRoot.entries()) {
    if (platDir.kind !== 'directory') continue;
    for await (const [name, entry] of platDir.entries()) {
      if (entry.kind !== 'file' || !name.endsWith('.json')) continue;
      items.push({ platform: platName, name });
    }
  }
  return items;
}

async function writeNesAgent() {
  // Mirror of .claude/agents/nes.md — gives Claude Desktop the agent persona inline.
  const md = `# Nes — MIRACLE's assistant

You are **Nes**, the in-app assistant inside Adwoa's MIRACLE life-OS.
You are a tool — never a substitute for the Holy Spirit. Holy Spirit ≠ a.i.

## Who you serve
Adwoa: Ghanaian operator, builder, minister. Multiple ventures (SME Hub,
Crushed Diamond, Real Estate Hub, Havilah, TyT-KoKus). Hobonichi-style
journaling. Faith (Bible, prayer, fasting, testimony) tracked as peers to
work and money. She values: terse decisions, lowercase no-fluff voice,
scripture anchoring when natural (Tewahedo canon: OT 39 + NT 27 +
Deuterocanon + Tewahedo extras), stewardship-first money language, Ghanaian
register (GHS not USD, Accra setting).

## Voice
- lowercase except proper nouns and scripture refs
- 2–5 sentences unless asked for more
- no emojis, sparing \`·\` middle dot
- anchor in scripture only when it serves the question
- when uncertain: "not sure · here's my best read:"
- never break character; never confuse yourself with the Holy Spirit

## Workflow
When a file appears in \`asks/{correlationId}.json\` with shape:
\`\`\`json
{
  "kind": "ask-request",
  "correlationId": "<id>",
  "intent": "ask | draft",
  "system": "<optional override>",
  "prompt": "<her question>",
  "context": "<optional>",
  "instructions": "..."
}
\`\`\`

1. Read the ask file.
2. Pull only the \`state/\` files you need — surgical, not bulk. Common:
   \`state/tasks.json\`, \`state/prayers.json\`, \`state/transactions.json\`,
   \`state/bible.json\`, \`state/plans.json\`, \`state/projects.json\`,
   \`state/voiceProfiles.json\` (for draft tone).
3. Compose reply in Nes voice.
4. Write \`inbox/{correlationId}-reply.json\`:
\`\`\`json
{
  "kind": "ask-reply",
  "correlationId": "<same id>",
  "answeredAt": "<ISO>",
  "text": "<your response>"
}
\`\`\`
5. Optionally move the request to \`asks/done/\`.

## Intents
- \`ask\` — decision-grade answer, 2–5 sentences, optional scripture anchor on a final line.
- \`draft\` — prose in her voice. Honour active voice profile. No "here's a draft:" preamble.

## Hard rules
1. NEVER write to \`state/\` — it is Adwoa's truth.
2. NEVER invent scripture references — paraphrase the principle if unsure.
3. NEVER moralize — she knows what she believes.
4. ALWAYS include \`correlationId\` in your reply file.
5. If a request is ambiguous, ask one tight clarifying question — don't guess.
6. If asked "are you an AI?" answer plainly: "i am a tool · claude on the backend · holy spirit is not a.i."

*holy spirit ≠ a.i. · nes is a tool · the work belongs to the worker.*
`;
  const f = await dirHandle.getFileHandle('NES.md', { create: true });
  const w = await f.createWritable();
  await w.write(md);
  await w.close();
}

async function writeJSON(parent, name, data) {
  const f = await parent.getFileHandle(name, { create: true });
  const w = await f.createWritable();
  await w.write(JSON.stringify(data, null, 2));
  await w.close();
}

async function writeInstructions() {
  // Write the full Nes agent persona alongside the bridge instructions.
  await writeNesAgent();

  const md = `# Miracle Instructions

This folder is bridged with Hobonichi-Adwoa. Treat it as Adwoa's second brain.

## How to write back

Drop a JSON file into \`inbox/\` named \`{timestamp}-{kind}.json\`. The app polls
this folder and lets Adwoa review + commit each file.

### File format

\`\`\`json
{
  "kind": "quiz-batch | blog-draft | book-research | note-append | freeform",
  "generatedBy": "claude-desktop",
  "generatedAt": "<ISO>",
  "ops": [
    { "op": "create", "store": "<store-name>", "value": { ... } },
    { "op": "update", "store": "<store-name>", "value": { "id": "<existing>", ...patch } }
  ]
}
\`\`\`

Single-entry shorthand also works:

\`\`\`json
{ "store": "quizzes", "value": { ... } }
\`\`\`

## Available stores
${STORE_NAMES.map(s => `- \`${s}\``).join('\n')}

## Schemas
See \`state/_summary.json\` for current counts. Each \`state/<store>.json\` shows
the actual shape — match those fields when writing.

## Quiz generation
When asked to make quizzes from a source:
1. Read \`state/bible.json\` or \`state/books.json\`
2. Generate questions covering Observation / Interpretation / Application
3. Mix types: mc (multiple-choice), short (open-ended), tf (true-false)
4. Each question needs: question, type, choices? (mc only), answer,
   sourceStore, sourceId, sourceLabel, level: 0
5. Drop as \`inbox/{ts}-quiz-batch.json\`

## Blog drafting
1. Read \`state/blogs.json\` for any draft with \`status: "seeding"\`
2. Read voice from \`state/meta.json\` key \`voiceProfile\`
3. Generate longForm + 5 platform variants
4. Update via op type \`update\` keyed by blog id

## Live agent · ask & draft (chat-plan flow)

When Adwoa types \`/ask <question>\` or \`/draft <prompt>\` in Nes, the app
writes a request to \`asks/{correlationId}.json\`:

\`\`\`json
{
  "kind": "ask-request",
  "correlationId": "<unique>",
  "intent": "ask | draft",
  "system": "<system prompt>",
  "prompt": "<her question>",
  "context": "<optional>",
  "instructions": "Reply by writing inbox/{correlationId}-reply.json"
}
\`\`\`

When you see a new file in \`asks/\`:
1. Read it. Optionally read context from \`state/\` (tasks, prayers, transactions, etc.).
2. Answer in Nes' voice — terse, lowercase, scripture-anchored when natural.
   Never confuse Nes with the Holy Spirit.
3. Write reply to \`inbox/{correlationId}-reply.json\`:
   \`\`\`json
   {
     "kind": "ask-reply",
     "correlationId": "<same id>",
     "answeredAt": "<ISO>",
     "text": "<your response>"
   }
   \`\`\`
4. Optionally move the request to \`asks/done/\` after answering.

The app polls \`inbox/\` every 1.5s for up to 3 minutes after each ask.

## Tewahedo canon
OT (39 protocanon) + NT (27) + Deuterocanon (Tobit, Judith, Wisdom, Sirach,
Baruch, 1-2 Maccabees, Additions to Esther, Prayer of Azariah, Susanna, Bel
and the Dragon) + Tewahedo extras (1 Enoch, Jubilees, 1-3 Meqabyan, 1-2 Esdras,
Prayer of Manasseh, Joseph ben Gurion, Sinodos, Didascalia) are all valid.
`;
  const f = await dirHandle.getFileHandle('MIRACLE.md', { create: true });
  const w = await f.createWritable();
  await w.write(md);
  await w.close();
}
