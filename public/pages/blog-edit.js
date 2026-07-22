import { get, put, ulid } from '../store.js';
import { BLOG_PLATFORMS, BLOG_STATUSES, VARIANT_STATUSES, PLATFORM_LIMITS, formatAgo } from '../domain.js';
import { exportBlogStatic } from '../blog-export.js';
import { queueForPublish, isConnected } from '../bridge.js';

import { esc } from '../util/esc.js';
import { formatList, toList } from '../util/list.js';
let activeTab = 'master';
const LIST_FIELDS = new Set(['topics', 'scriptureRefs']);

export async function render([id]) {
  const blog = await get('blogs', id);
  const root = document.createElement('div');
  root.className = 'page';

  if (!blog) {
    root.innerHTML = `<div class="page-head"><h1 class="page-title">blog</h1><span class="page-meta">not found</span></div>`;
    return root;
  }

  blog.variants = blog.variants || [];

  root.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">${esc(blog.title || '(untitled)')}</h1>
      <span class="page-meta">${esc(blog.status || 'seeding')} · ${blog.variants.length} variants · updated ${formatAgo(blog.updatedAt)}</span>
    </div>

    <div class="blog-tabs">
      <button class="blog-tab ${activeTab === 'seed'     ? 'is-active' : ''}" data-tab="seed">seed</button>
      <button class="blog-tab ${activeTab === 'master'   ? 'is-active' : ''}" data-tab="master">master</button>
      <button class="blog-tab ${activeTab === 'variants' ? 'is-active' : ''}" data-tab="variants">variants</button>
      <button class="blog-tab ${activeTab === 'meta'     ? 'is-active' : ''}" data-tab="meta">meta</button>
    </div>

    <div class="blog-tab-body" id="bl-body"></div>
  `;

  const body = root.querySelector('#bl-body');

  function paintBody() {
    if (activeTab === 'seed')      body.innerHTML = renderSeed(blog);
    if (activeTab === 'master')    body.innerHTML = renderMaster(blog);
    if (activeTab === 'variants')  body.innerHTML = renderVariants(blog);
    if (activeTab === 'meta')      body.innerHTML = renderMeta(blog);
    attachHandlers();
  }

  function attachHandlers() {
    body.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('blur', async e => {
        const k = el.dataset.field;
        blog[k] = LIST_FIELDS.has(k) ? toList(e.target.value) : e.target.value;
        await put('blogs', blog);
      });
      if (el.tagName === 'SELECT') {
        el.addEventListener('change', async e => {
          blog[el.dataset.field] = e.target.value;
          await put('blogs', blog);
          root.replaceWith(await render([id]));
        });
      }
    });

    body.querySelectorAll('[data-variant-field]').forEach(el => {
      el.addEventListener('blur', async e => {
        const idx = Number(el.dataset.variantIdx);
        const k   = el.dataset.variantField;
        blog.variants[idx][k] = e.target.value;
        await put('blogs', blog);
      });
      if (el.tagName === 'SELECT') {
        el.addEventListener('change', async e => {
          const idx = Number(el.dataset.variantIdx);
          blog.variants[idx][el.dataset.variantField] = e.target.value;
          await put('blogs', blog);
        });
      }
    });

    body.querySelectorAll('[data-act="add-variant"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const platform = btn.dataset.platform;
        if (blog.variants.some(v => v.platform === platform)) return;
        blog.variants.push({
          id: ulid().slice(-6),
          platform,
          body: '',
          hashtags: '',
          status: 'draft',
        });
        await put('blogs', blog);
        paintBody();
      });
    });

    body.querySelectorAll('[data-act="del-variant"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.dataset.variantIdx);
        if (!confirm('remove this variant?')) return;
        blog.variants.splice(idx, 1);
        await put('blogs', blog);
        paintBody();
      });
    });

    body.querySelectorAll('[data-act="approve-variant"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.dataset.variantIdx);
        blog.variants[idx].status = blog.variants[idx].status === 'approved' ? 'draft' : 'approved';
        await put('blogs', blog);
        paintBody();
      });
    });

    body.querySelectorAll('[data-act="publish-static"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('publish this post as static HTML to sync/published/?')) return;
        try {
          const r = await exportBlogStatic(blog.id);
          alert(`published · ${r.file}`);
          const fresh = await get('blogs', id);
          Object.assign(blog, fresh);
          paintBody();
        } catch (e) { alert(`error · ${e.message}`); }
      });
    });

    body.querySelectorAll('[data-act="queue-publish"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!isConnected()) { alert('bridge not connected. run /sync connect first.'); return; }
        const idx = Number(btn.dataset.variantIdx);
        const v = blog.variants[idx];
        try {
          const r = await queueForPublish(blog.id, v.id);
          alert(`queued · ${r.platform} · ${r.file}\n\nclaude desktop will pick up from outbox/${r.platform}/.`);
          const fresh = await get('blogs', id);
          Object.assign(blog, fresh);
          paintBody();
        } catch (e) { alert(`error · ${e.message}`); }
      });
    });

    body.querySelectorAll('[data-act="copy-variant"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const idx = Number(btn.dataset.variantIdx);
        const v = blog.variants[idx];
        const tags = (v.hashtags || '').split(/[\s,]+/).filter(Boolean).map(t => t.startsWith('#') ? t : '#' + t).join(' ');
        const text = (v.body || '') + (tags ? '\n\n' + tags : '');
        await navigator.clipboard.writeText(text);
        btn.textContent = 'copied ✓';
        setTimeout(() => btn.textContent = 'copy', 1200);
      });
    });
  }

  root.querySelectorAll('.blog-tab').forEach(t => {
    t.addEventListener('click', () => { activeTab = t.dataset.tab; root.querySelectorAll('.blog-tab').forEach(x => x.classList.toggle('is-active', x === t)); paintBody(); });
  });

  paintBody();
  return root;
}
function renderSeed(b) {
  return `
    <div class="blog-pane">
      <div class="drawer-label">seed source · ${esc(b.seedSource || 'manual')} · ${esc((b.seedCapturedAt || b.createdAt || '').slice(0, 10))}</div>
      <textarea data-field="seedText" placeholder="the raw thought, untouched">${esc(b.seedText || '')}</textarea>
      <p class="meta" style="margin-top:24px">seed is never overwritten by drafting. it stays as origin.</p>
    </div>
  `;
}
function renderMaster(b) {
  return `
    <div class="blog-pane">
      <div class="drawer-field"><label class="drawer-label">title</label>
        <input type="text" data-field="title" value="${esc(b.title || '')}"></div>
      <div class="drawer-field"><label class="drawer-label">hook (1-2 lines, tested separately)</label>
        <input type="text" data-field="hook" value="${esc(b.hook || '')}"></div>
      <div class="drawer-field"><label class="drawer-label">long-form (master)</label>
        <textarea data-field="longForm" rows="20" placeholder="canonical long-form. markdown ok.">${esc(b.longForm || '')}</textarea></div>
      <div class="drawer-field"><label class="drawer-label">cta</label>
        <input type="text" data-field="cta" value="${esc(b.cta || '')}"></div>
    </div>
  `;
}

function renderVariants(b) {
  const presentPlatforms = new Set(b.variants.map(v => v.platform));
  const missingPlatforms = BLOG_PLATFORMS.filter(p => !presentPlatforms.has(p));

  return `
    <div class="blog-pane">
      <div class="variant-add">
        <span class="drawer-label">add variant</span>
        ${missingPlatforms.map(p => `<button class="btn" data-act="add-variant" data-platform="${p}">+ ${p}</button>`).join('')}
      </div>

      ${b.variants.length === 0 ? `<div class="empty">no variants yet. add one above.</div>` : b.variants.map((v, idx) => {
        const limit = PLATFORM_LIMITS[v.platform]?.chars || 0;
        const len = (v.body || '').length;
        const over = limit && len > limit;
        return `
          <div class="variant-card">
            <div class="variant-head">
              <span class="variant-platform">${esc(v.platform)}</span>
              <span class="meta">${esc(v.status || 'draft')}</span>
              <span class="meta num ${over ? 'ruby' : ''}">${len}${limit ? ' / ' + limit : ''}</span>
              <span class="variant-actions">
                <button class="btn" data-act="copy-variant" data-variant-idx="${idx}">copy</button>
                <button class="btn ${v.status === 'approved' ? 'is-primary' : ''}" data-act="approve-variant" data-variant-idx="${idx}">${v.status === 'approved' ? 'approved' : 'approve'}</button>
                ${v.platform === 'blog' && v.status === 'approved' ? `<button class="btn is-primary" data-act="publish-static">publish static</button>` : ''}
                ${v.platform !== 'blog' && v.status === 'approved' ? `<button class="btn is-primary" data-act="queue-publish" data-variant-idx="${idx}">queue → ${esc(v.platform)}</button>` : ''}
                ${v.status === 'queued' ? `<span class="meta">queued ${esc((v.scheduledFor || '').slice(11, 16))}</span>` : ''}
                <button class="btn is-danger" data-act="del-variant" data-variant-idx="${idx}">×</button>
              </span>
            </div>
            <textarea data-variant-field="body" data-variant-idx="${idx}" rows="${v.platform === 'blog' ? 16 : 6}" placeholder="${esc(v.platform)} copy">${esc(v.body || '')}</textarea>
            <div class="variant-foot">
              <input type="text" data-variant-field="hashtags" data-variant-idx="${idx}" value="${esc(v.hashtags || '')}" placeholder="hashtags (comma or space)">
              ${v.externalUrl ? `<a href="${esc(v.externalUrl)}" target="_blank" rel="noopener">${esc(v.externalUrl)}</a>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderMeta(b) {
  return `
    <div class="blog-pane">
      <div class="drawer-field"><label class="drawer-label">status</label>
        <select data-field="status">${BLOG_STATUSES.map(s => `<option value="${s}" ${s === (b.status||'seeding') ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="drawer-field"><label class="drawer-label">topics (comma-sep)</label>
        <input type="text" data-field="topics" value="${esc(formatList(b.topics))}"></div>
      <div class="drawer-field"><label class="drawer-label">series</label>
        <input type="text" data-field="series" value="${esc(b.series || '')}"></div>
      <div class="drawer-field"><label class="drawer-label">scripture refs (comma-sep)</label>
        <input type="text" data-field="scriptureRefs" value="${esc(formatList(b.scriptureRefs))}"></div>
      <div class="drawer-field"><label class="drawer-label">voice profile id</label>
        <input type="text" data-field="voiceProfile" value="${esc(b.voiceProfile || '')}"></div>
      <div class="drawer-field"><label class="drawer-label">origin (idea/plan/dream id)</label>
        <input type="text" data-field="linkedTo" value="${esc(b.linkedTo || '')}"></div>
    </div>
  `;
}
