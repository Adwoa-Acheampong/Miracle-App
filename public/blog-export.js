// Static blog HTML export. Writes one HTML file per published blog to sync/published/.

import { all, get, put } from './store.js';
import { isConnected } from './bridge.js';
import { toList } from './util/list.js';

export async function exportBlogStatic(blogId) {
  const blog = await get('blogs', blogId);
  if (!blog) throw new Error('blog not found');
  if (!isConnected()) throw new Error('bridge not connected. /sync connect first.');

  const meta = await get('meta', 'bridge.dirHandle');
  const dirHandle = meta?.value;
  if (!dirHandle) throw new Error('bridge handle missing.');
  if ((await dirHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
    if ((await dirHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
      throw new Error('permission denied');
    }
  }

  const published = await dirHandle.getDirectoryHandle('published', { create: true });
  const slug = slugify(blog.title || blog.id.slice(-6));
  const fname = `${slug}.html`;
  const html = renderHTML(blog);
  const f = await published.getFileHandle(fname, { create: true });
  const w = await f.createWritable();
  await w.write(html);
  await w.close();

  // Also write/update the index
  await writeIndex(published);

  // Record variant
  const variants = blog.variants || [];
  const existing = variants.find(v => v.platform === 'blog');
  const now = new Date().toISOString();
  const variant = existing || { id: ulid6(), platform: 'blog' };
  variant.status = 'published';
  variant.publishedAt = now;
  variant.externalUrl = `published/${fname}`;
  variant.connector = 'static';
  if (!existing) variants.push(variant);
  blog.variants = variants;
  if (blog.status !== 'published') blog.status = 'published';
  await put('blogs', blog);

  return { file: fname, url: `published/${fname}` };
}

function renderHTML(blog) {
  const title = escapeHtml(blog.title || 'untitled');
  const body  = mdToHtml(blog.longForm || blog.seedText || '');
  const topics = toList(blog.topics);
  const scripture = toList(blog.scriptureRefs);
  const date = (blog.publishedAt || new Date().toISOString()).slice(0, 10);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · adwoa</title>
<meta name="author" content="Adwoa B. Acheampong">
<meta name="description" content="${escapeHtml(blog.hook || '').slice(0, 160)}">
<style>
  :root { --bg:#0A0A0C; --bg-1:#111114; --ink:#E8E6E1; --ink-1:#A8A6A0; --ink-2:#6E6C66; --line:rgba(255,255,255,0.08); --emerald:#10B981; --ruby:#E11D48; }
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:'Inter',-apple-system,system-ui,sans-serif;font-size:14px;line-height:1.7;letter-spacing:-0.003em;-webkit-font-smoothing:antialiased}
  main{max-width:680px;margin:96px auto;padding:0 24px}
  .meta{font-size:10px;color:var(--ink-2);text-transform:uppercase;letter-spacing:0.14em;margin-bottom:24px;font-family:'JetBrains Mono',monospace}
  h1{font-size:28px;font-weight:500;letter-spacing:-0.02em;line-height:1.2;margin:0 0 16px}
  .hook{font-size:16px;color:var(--ink-1);margin-bottom:48px;line-height:1.6}
  article p{margin:0 0 18px}
  article h2{font-size:16px;color:var(--ink);margin:40px 0 12px;text-transform:none;letter-spacing:-0.01em;font-weight:500}
  article h3{font-size:14px;color:var(--ink-1);margin:32px 0 12px;font-weight:500}
  article blockquote{margin:24px 0;padding:0 0 0 16px;border-left:2px solid var(--emerald);color:var(--ink-1);font-style:italic}
  article code{background:rgba(16,185,129,0.12);color:var(--emerald);padding:1px 5px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:0.92em}
  article a{color:var(--emerald);text-decoration:none;border-bottom:1px dotted var(--emerald)}
  footer{margin-top:80px;padding-top:24px;border-top:1px solid var(--line);font-size:11px;color:var(--ink-2);display:flex;flex-wrap:wrap;gap:12px}
  footer .tag{padding:2px 8px;border:1px solid var(--line);border-radius:100px;color:var(--ink-1)}
  footer .scripture{color:var(--emerald)}
</style>
</head>
<body>
<main>
  <div class="meta">${date} · adwoa b. acheampong</div>
  <h1>${title}</h1>
  ${blog.hook ? `<p class="hook">${escapeHtml(blog.hook)}</p>` : ''}
  <article>${body}</article>
  ${blog.cta ? `<p class="hook" style="margin-top:48px">${escapeHtml(blog.cta)}</p>` : ''}
  <footer>
    ${topics.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join('')}
    ${scripture.map(s => `<span class="tag scripture">${escapeHtml(s)}</span>`).join('')}
  </footer>
</main>
</body>
</html>`;
}

async function writeIndex(publishedDir) {
  // Read all html files in published/, generate index.html
  const items = [];
  for await (const [name, entry] of publishedDir.entries()) {
    if (entry.kind !== 'file' || !name.endsWith('.html') || name === 'index.html') continue;
    const file = await entry.getFile();
    const text = await file.text();
    const titleMatch = text.match(/<title>([^<]+)</);
    const dateMatch  = text.match(/<div class="meta">([^·]+)·/);
    items.push({
      file: name,
      title: titleMatch ? titleMatch[1].replace(' · adwoa', '').trim() : name,
      date: dateMatch ? dateMatch[1].trim() : '',
    });
  }
  items.sort((a, b) => b.date.localeCompare(a.date));
  const indexHTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>adwoa · writing</title>
<style>
  body{margin:0;background:#0A0A0C;color:#E8E6E1;font-family:'Inter',-apple-system,system-ui,sans-serif;font-size:14px;line-height:1.7;letter-spacing:-0.003em;-webkit-font-smoothing:antialiased}
  main{max-width:680px;margin:96px auto;padding:0 24px}
  h1{font-size:24px;font-weight:500;letter-spacing:-0.02em;margin:0 0 48px}
  .meta{font-size:10px;color:#6E6C66;text-transform:uppercase;letter-spacing:0.14em;font-family:'JetBrains Mono',monospace;margin-bottom:48px}
  ul{list-style:none;padding:0;margin:0}
  li{display:grid;grid-template-columns:80px 1fr;gap:16px;padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.08)}
  li .date{color:#6E6C66;font-family:'JetBrains Mono',monospace;font-size:11px}
  li a{color:#E8E6E1;text-decoration:none}
  li a:hover{color:#10B981}
</style>
</head>
<body>
<main>
  <div class="meta">writing · adwoa b. acheampong</div>
  <h1>essays + notes</h1>
  <ul>
    ${items.map(i => `<li><span class="date">${escapeHtml(i.date)}</span><a href="${i.file}">${escapeHtml(i.title)}</a></li>`).join('')}
  </ul>
</main>
</body>
</html>`;
  const f = await publishedDir.getFileHandle('index.html', { create: true });
  const w = await f.createWritable();
  await w.write(indexHTML);
  await w.close();
}

function mdToHtml(md) {
  // Minimal: paragraphs, headings, blockquotes, bold, italic, inline code, links.
  let s = String(md || '').trim();
  // escape angle brackets first to avoid xss from seed
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // headings
  s = s.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  // blockquote
  s = s.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
  // links [t](u)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  // bold + italic
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // paragraphs
  s = s.split(/\n{2,}/).map(p => {
    if (/^<(h\d|blockquote|ul|ol|pre)/.test(p)) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  return s;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'untitled';
}
function ulid6() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase().slice(-6);
}
