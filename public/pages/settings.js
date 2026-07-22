import { all, get, put } from '../store.js';
import { connect, exportAll, checkInbox, listOutbox, isConnected, loadHandle } from '../bridge.js';
import { loadClaudeConfig, saveClaudeConfig } from '../claude-client.js';
import { isSupported as notifSupported, permission as notifPerm, requestPermission as notifReq, isEnabled as notifEnabled, setEnabled as notifSet, notify as notifSend } from '../notifications.js';
import { computeFTI } from '../fti.js';
import { navigate } from '../router.js';
import { getCachedUser, sendVerificationEmail, me as refreshMe, isAuthed } from '../auth.js';

import { esc } from '../util/esc.js';
const THEMES = [
  { id: 'eden-night',  label: 'eden night',  swatch: ['#050608', '#0C0E11', '#10B981', '#34D399'] },
  { id: 'manna-paper', label: 'manna paper', swatch: ['#F6F1E5', '#EFE8D6', '#047857', '#BE123C'] },
  { id: 'zion-watch',  label: 'zion watch',  swatch: ['#0D1117', '#161B22', '#3FB950', '#F85149'] },
  { id: 'selah-mocha', label: 'selah mocha', swatch: ['#1E1E2E', '#181825', '#A6E3A1', '#F38BA8'] },
];
const THEME_ALIASES = {
  'claude-dark': 'eden-night',
  'claude-light': 'manna-paper',
  'github-dark': 'zion-watch',
  'catppuccin-mocha': 'selah-mocha',
};
const MODES = [
  { id: 'minimalist', blurb: 'tight type · sparse · for adhd brain' },
  { id: 'regular',    blurb: 'breathable · standard density' },
  { id: 'extreme',    blurb: 'maximal · big numbers · everything visible' },
];
const TWEAKS = [
  { key: 'jumpGlow',          label: 'jump glow on hover' },
  { key: 'scriptureCursive',  label: 'scripture in cursive' },
  { key: 'animations',        label: 'page animations' },
];

export async function render() {
  await loadHandle();

  const prefsRow = (await get('meta', 'prefs')) || { value: { theme: 'eden-night', mode: 'minimalist', tweaks: {} } };
  const prefs = { ...prefsRow.value, theme: normalizeTheme(prefsRow.value?.theme) };

  const counts = {};
  const ALL_STORES = ['daily','dreams','ideas','bible','prayers','fasts','plans','projects','tasks','events','meals','transactions','budgets','blogs','books','quizzes','voiceProfiles','postMetrics','fti','testimonies','music','people','meta'];
  for (const s of ALL_STORES) {
    try { counts[s] = (await all(s)).length; } catch { counts[s] = 0; }
  }
  const voices = await all('voiceProfiles');
  const fti = await computeFTI();
  const claudeCfg = await loadClaudeConfig();

  const root = document.createElement('div');
  root.className = 'page page-wide';
  // Build email-verification banner (only if logged in)
  const user = getCachedUser();
  const showVerifyBanner = isAuthed() && user && !user.emailVerified;
  const verifyBannerHtml = showVerifyBanner ? `
    <div class="verify-banner" id="verify-banner">
      <span class="verify-banner-icon">✉️</span>
      <div class="verify-banner-body">
        <strong>verify your email</strong>
        <span class="meta">${esc(user.email)} — unverified emails can't recover passwords or PINs. if you forget, you lose access.</span>
      </div>
      <button class="btn is-primary" id="verify-resend">resend email</button>
    </div>
  ` : (isAuthed() && user?.emailVerified ? `
    <div class="verify-banner is-ok">
      <span class="verify-banner-icon">✓</span>
      <div class="verify-banner-body">
        <strong>email verified</strong>
        <span class="meta">${esc(user.email)} — password &amp; PIN recovery active.</span>
      </div>
    </div>
  ` : '');

  root.innerHTML = `
    ${verifyBannerHtml}
    <div class="page-head">
      <h1 class="page-title">settings</h1>
      <nav class="settings-anchor-nav">
        <a href="#sec-theme"  data-anchor="sec-theme">appearance</a>
        <a href="#sec-knobs"  data-anchor="sec-knobs">knobs</a>
        <a href="#sec-contact" data-anchor="sec-contact">contact</a>
        <a href="#sec-notif"  data-anchor="sec-notif">notifications</a>
        <a href="#sec-moji"   data-anchor="sec-moji">moji</a>
        <a href="#sec-streaks" data-anchor="sec-streaks">streaks</a>
        <a href="#sec-fti"    data-anchor="sec-fti">fti</a>
        <a href="#sec-export" data-anchor="sec-export">export</a>
        <a href="#sec-storage" data-anchor="sec-storage">storage</a>
      </nav>
    </div>

    <section class="daily-section" id="sec-theme">
      <div class="label">theme</div>
      <div class="theme-grid">
        ${THEMES.map(t => `
          <button class="theme-tile ${prefs.theme === t.id ? 'is-active' : ''}" data-theme="${t.id}">
            <div class="theme-swatch">${t.swatch.map(c => `<div style="background:${c}"></div>`).join('')}</div>
            <div class="theme-label">${t.label}</div>
          </button>
        `).join('')}
      </div>
    </section>

    <section class="daily-section">
      <div class="label">mode (density)</div>
      <div class="mode-row">
        ${MODES.map(m => `
          <button class="mode-tile ${prefs.mode === m.id ? 'is-active' : ''}" data-mode="${m.id}">
            <div class="mode-id">${m.id}</div>
            <div class="meta">${m.blurb}</div>
          </button>
        `).join('')}
      </div>
    </section>

    <section class="daily-section" id="sec-knobs">
      <div class="label">design knobs</div>
      <div class="tweak-rows">
        ${TWEAKS.map(t => `
          <div class="tweak-row">
            <span>${t.label}</span>
            <span class="toggle ${prefs.tweaks?.[t.key] === 'on' ? 'is-on' : ''}" data-tweak="${t.key}" role="switch" tabindex="0"></span>
          </div>
        `).join('')}
        <div class="tweak-row">
          <span>completion sound (440hz tone on task close)</span>
          <span class="toggle ${localStorage.getItem('miracle_sound') === '1' ? 'is-on' : ''}" id="sound-toggle" role="switch" tabindex="0"></span>
        </div>
        <div class="tweak-row">
          <span>focus mode (press <kbd>F</kbd>)</span>
          <span class="toggle ${sessionStorage.getItem('miracle_focus_mode') === '1' ? 'is-on' : ''}" id="focus-toggle" role="switch" tabindex="0"></span>
        </div>
        <div class="tweak-row">
          <span>welcome tour</span>
          <button class="btn" id="tour-replay" type="button">show tour</button>
        </div>
      </div>
    </section>

    <section class="daily-section" id="sec-contact">
      <div class="label">contact · support</div>
      <div class="settings-block contact-block">
        <p style="margin: 0 0 var(--sp-2); color: var(--ink-1); line-height: 1.55;">
          message the builder directly — bugs, feature requests, prayer requests, or just a hello.
        </p>
        <div class="contact-row">
          <span class="contact-key">email</span>
          <a href="mailto:cc@miracleapp.site" class="contact-val" id="contact-email">cc@miracleapp.site</a>
          <button class="btn" id="contact-copy">copy</button>
        </div>
        <div class="contact-row">
          <span class="contact-key">subject prefix</span>
          <span class="contact-val">[miracle] &lt;short topic&gt;</span>
        </div>
        <div class="contact-actions" style="margin-top: var(--sp-3); display: flex; gap: var(--sp-2); flex-wrap: wrap;">
          <a class="btn is-primary" href="mailto:cc@miracleapp.site?subject=%5BMiracle%5D%20Feedback">send email</a>
          <a class="btn" href="mailto:cc@miracleapp.site?subject=%5BMiracle%5D%20Bug%20Report&body=What%20happened%3A%0A%0AWhat%20you%20expected%3A%0A%0ABrowser%20%2F%20device%3A%0A">report a bug</a>
          <a class="btn" href="mailto:cc@miracleapp.site?subject=%5BMiracle%5D%20Feature%20Request&body=The%20idea%3A%0A%0AWhy%20it%20matters%3A%0A">request a feature</a>
          <a class="btn" href="mailto:cc@miracleapp.site?subject=%5BMiracle%5D%20Prayer%20Request&body=Subject%3A%0A%0AContext%3A%0A">prayer request</a>
        </div>

        <div class="feedback-card" id="feedback-card">
          <div class="feedback-head">
            <select id="fb-kind" class="fb-kind">
              <option value="feature">Is there an integration you'd like to see added?</option>
              <option value="bug">Found a bug? Tell us what broke.</option>
              <option value="idea">Got an idea to make miracle better?</option>
              <option value="prayer">Want to share a prayer request?</option>
              <option value="other">Other — leave a note.</option>
            </select>
            <button class="fb-close" id="fb-close" aria-label="close">×</button>
          </div>
          <textarea id="fb-msg" rows="6" placeholder="please share the tool name and how you'd use it." spellcheck="true"></textarea>
          <div class="fb-foot">
            <span class="fb-status meta" id="fb-status"></span>
            <button class="btn is-primary" id="fb-send">share feedback</button>
          </div>
        </div>
      </div>
    </section>

    <section class="daily-section" id="sec-notif">
      <div class="label">notifications · desktop &amp; mobile</div>
      <div class="settings-block">
        <div class="settings-row">
          <span>browser status</span>
          <span class="${notifPerm() === 'granted' ? 'emerald' : ''}">${notifSupported() ? notifPerm() : 'unsupported'}</span>
        </div>
        <div class="settings-row">
          <span>enable notifications</span>
          <span class="toggle ${notifEnabled() ? 'is-on' : ''}" id="notif-toggle" role="switch" tabindex="0"></span>
        </div>
        <div class="settings-actions">
          <button class="btn" id="notif-grant">grant browser permission</button>
          <button class="btn" id="notif-test">send test notification</button>
        </div>
        <div class="meta" style="margin-top: 12px; line-height: 1.55;">
          gentle pings when something needs you — a streak about to lapse, an event coming up. you can always silence them here.
        </div>
      </div>
    </section>

    <section class="daily-section" id="sec-moji">
      <div class="label">moji · this is a charity</div>
      <div class="settings-block" style="line-height: 1.6">
        <p style="margin: 0 0 var(--sp-2)">subscriptions to moji are <em>not</em> a paywall.
        every cedi from the <strong style="color: var(--color-gold)">premium</strong> and
        <strong style="color: var(--emerald)">kingdom</strong> tiers goes to
        the host of <em>orphans, widows, and the church-builder fund</em> directed by adwoa.</p>
        <p style="margin: 0 0 var(--sp-2); color: var(--ink-2);">free tier is fully featured for journaling.
        upgrading is the way to give while you build — your avatar grows, someone else's life grows too.</p>
        <button class="btn moji-open" id="moji-open" style="display: inline-flex; align-items: center; gap: 6px; margin-top: 6px">→ open moji</button>
      </div>
    </section>

    <section class="daily-section" id="sec-streaks">
      <div class="label">streaks · current</div>
      <div class="settings-block">
        <div class="streak-summary" id="streak-summary"></div>
      </div>
    </section>

    <details class="dev-disclosure" id="sec-dev">
      <summary class="dev-disclosure-summary">
        <span class="dev-glyph">⌖</span>
        <span class="dev-title">developer · advanced integrations</span>
        <span class="dev-hint">backend bridges · api keys · voice profiles</span>
      </summary>

    <section class="daily-section">
      <div class="label">claude api · nes intelligence</div>
      <div class="settings-block">
        <div class="settings-row">
          <span>status</span>
          <span class="${claudeCfg.enabled && claudeCfg.apiKey ? 'emerald' : ''}" id="claude-status">${claudeCfg.enabled && claudeCfg.apiKey ? 'enabled' : 'disabled'}</span>
        </div>
        <div class="settings-row">
          <label for="claude-key">anthropic api key</label>
          <input type="password" id="claude-key" autocomplete="off" spellcheck="false" placeholder="sk-ant-..." value="${claudeCfg.apiKey ? claudeCfg.apiKey.slice(0, 8) + '…' + claudeCfg.apiKey.slice(-4) : ''}" style="flex:1;max-width:280px;background:var(--bg-2);border:1px solid var(--line);padding:4px 8px;border-radius:4px;color:var(--ink-0);font-family:var(--font-mono);font-size:11px;">
        </div>
        <div class="settings-row">
          <label for="claude-model">model</label>
          <select id="claude-model" style="background:var(--bg-2);border:1px solid var(--line);padding:4px 8px;border-radius:4px;color:var(--ink-0);font-size:11px;">
            <option value="claude-opus-4-7" ${claudeCfg.model === 'claude-opus-4-7' ? 'selected' : ''}>opus 4.7 (most capable)</option>
            <option value="claude-sonnet-4-6" ${claudeCfg.model === 'claude-sonnet-4-6' ? 'selected' : ''}>sonnet 4.6 (balanced)</option>
            <option value="claude-haiku-4-5-20251001" ${claudeCfg.model === 'claude-haiku-4-5-20251001' ? 'selected' : ''}>haiku 4.5 (fast)</option>
          </select>
        </div>
        <div class="settings-row">
          <span>enabled</span>
          <span class="toggle ${claudeCfg.enabled ? 'is-on' : ''}" id="claude-toggle" role="switch" tabindex="0"></span>
        </div>
        <div class="settings-actions">
          <button class="btn is-primary" id="claude-save">save</button>
          <button class="btn" id="claude-test">test connection</button>
        </div>
        <div class="meta" style="margin-top: 12px; line-height: 1.6;">
          get an api key from <code>console.anthropic.com</code>. when enabled, nes resolves <code>/ask &lt;question&gt;</code> and <code>/draft &lt;text&gt;</code> via claude. key stored in your local indexeddb only — never uploaded.
        </div>
        <div class="meta" id="claude-msg" style="margin-top: 8px"></div>
      </div>
    </section>

    <section class="daily-section">
      <div class="label">claude desktop bridge</div>
      <div class="settings-block">
        <div class="settings-row">
          <span>status</span>
          <span class="${isConnected() ? 'emerald' : ''}" id="bridge-status">${isConnected() ? 'connected' : 'not connected'}</span>
        </div>
        <div class="settings-actions">
          <button class="btn is-primary" id="bridge-connect">${isConnected() ? 'reconnect folder' : 'connect folder'}</button>
          <button class="btn" id="bridge-export" ${isConnected() ? '' : 'disabled'}>export state</button>
          <button class="btn" id="bridge-inbox"  ${isConnected() ? '' : 'disabled'}>check inbox</button>
          <button class="btn" id="bridge-outbox" ${isConnected() ? '' : 'disabled'}>check outbox</button>
        </div>
        <div class="meta" style="margin-top: 12px; line-height: 1.6;">
          point a filesystem MCP server in claude desktop at the folder you connect. <code>MIRACLE.md</code> at the folder root explains the file format claude should write to <code>inbox/</code>.
        </div>
        <div class="meta" id="bridge-msg" style="margin-top: 8px"></div>
      </div>
    </section>

    <section class="daily-section">
      <div class="label">voice profiles</div>
      ${voices.length === 0 ? `
        <div class="empty">no profiles. open miracle and run <code>/voice train</code> — paste the prompt into claude desktop with the bridge connected.</div>
      ` : `
        <ul class="entry-list">
          ${voices.map(v => `
            <li class="entry-row" data-store="voiceProfiles" data-id="${v.id}">
              <span class="dot ${v.active === 'yes' ? 'emerald' : ''}"></span>
              <span class="title">${esc(v.name || '(unnamed)')} ${v.active === 'yes' ? '<span class="meta">· active</span>' : ''}</span>
              <span class="meta-id">${(v.id || '').slice(-6)}</span>
            </li>
          `).join('')}
        </ul>
      `}
    </section>

    </details>

    <section class="daily-section" id="sec-fti">
      <div class="label">today's fti</div>
      <div class="fti-row">
        <div class="fti-num">${fti.score}</div>
        <div class="fti-meta">
          <div class="fti-bar"><span style="width:${fti.score}%"></span></div>
          <div class="meta">snapshots when you load the app. open <code>/dashboard</code> for the trend view.</div>
        </div>
      </div>
    </section>

    <section class="daily-section" id="sec-export">
      <div class="label">export</div>
      <div class="settings-actions">
        <button class="btn" id="export-json">download json snapshot</button>
        <button class="btn" id="reset-db">reset (delete db)</button>
      </div>
      <div class="meta" style="margin-top: 8px">json works as a full backup. reset clears indexeddb — irreversible.</div>
    </section>

    <section class="daily-section" id="sec-storage">
      <div class="label">storage</div>
      <div class="settings-grid">
        ${Object.entries(counts).map(([s, n]) => `
          <div class="settings-stat"><span>${s}</span><span class="num">${n}</span></div>
        `).join('')}
      </div>
    </section>

    <section class="daily-section">
      <div class="label">capture cheatsheet</div>
      <div class="settings-cheats">
        <div class="cheat"><span>open miracle</span><kbd>⌘M</kbd> / <kbd>Ctrl+M</kbd></div>
        <div class="cheat"><span>jump to a page</span><kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd></div>
        <div class="cheat"><span>list every command</span><code>/help</code></div>
        <div class="cheat"><span>or click the <strong>+ new</strong> button on any domain page</span></div>
      </div>
    </section>
  `;

  const msg = root.querySelector('#bridge-msg');
  const setMsg = (t, cls = '') => { msg.textContent = t; msg.className = 'meta ' + cls; };

  root.querySelector('#bridge-connect').addEventListener('click', async () => {
    try { const n = await connect(); setMsg(`connected · ${n}`, 'emerald'); setTimeout(() => location.hash = '/settings', 600); }
    catch (e) { setMsg(`error · ${e.message}`, 'ruby'); }
  });
  root.querySelector('#bridge-export').addEventListener('click', async () => {
    try { const s = await exportAll(); setMsg(`exported · ${Object.values(s.counts).reduce((a, b) => a + b, 0)} rows across ${Object.keys(s.counts).length} stores`, 'emerald'); }
    catch (e) { setMsg(`error · ${e.message}`, 'ruby'); }
  });
  root.querySelector('#bridge-inbox').addEventListener('click', async () => {
    try { const items = await checkInbox(); setMsg(items.length ? `inbox · ${items.length} pending · open miracle and run /sync apply <name>` : 'inbox empty', items.length ? 'emerald' : ''); }
    catch (e) { setMsg(`error · ${e.message}`, 'ruby'); }
  });
  root.querySelector('#bridge-outbox').addEventListener('click', async () => {
    try { const items = await listOutbox(); setMsg(items.length ? `outbox · ${items.length} pending publishes` : 'outbox empty', items.length ? 'emerald' : ''); }
    catch (e) { setMsg(`error · ${e.message}`, 'ruby'); }
  });

  root.querySelector('#export-json').addEventListener('click', async () => {
    const dump = {};
    for (const s of ALL_STORES) { try { dump[s] = await all(s); } catch {} }
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hobonichi-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  root.querySelector('#reset-db').addEventListener('click', async () => {
    if (!confirm('delete the entire local database? this cannot be undone.')) return;
    if (!confirm('really delete everything?')) return;
    indexedDB.deleteDatabase('hobonichi-adwoa');
    localStorage.clear();
    setTimeout(() => location.reload(), 400);
  });

  root.querySelectorAll('.entry-row').forEach(row => {
    row.addEventListener('click', async () => {
      const { openDrawer } = await import('../drawer.js');
      openDrawer(row.dataset.store, row.dataset.id);
    });
  });
  window.addEventListener('drawer:close', once(() => { if (root.isConnected) navigate('/settings'); }), { once: true });

  // Appearance handlers
  const saveAndApply = async (next) => {
    await put('meta', { key: 'prefs', value: next });
    applyPrefs(next);
  };
  root.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => {
    const next = { ...prefs, theme: b.dataset.theme };
    saveAndApply(next);
    root.querySelectorAll('[data-theme]').forEach(x => x.classList.toggle('is-active', x === b));
    prefs.theme = b.dataset.theme;
  }));
  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    const next = { ...prefs, mode: b.dataset.mode };
    saveAndApply(next);
    root.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('is-active', x === b));
    prefs.mode = b.dataset.mode;
  }));
  root.querySelectorAll('[data-tweak]').forEach(toggle => {
    const flip = () => {
      const on = !toggle.classList.contains('is-on');
      toggle.classList.toggle('is-on', on);
      const tweaks = { ...(prefs.tweaks || {}), [toggle.dataset.tweak]: on ? 'on' : 'off' };
      const next = { ...prefs, tweaks };
      saveAndApply(next);
      prefs.tweaks = tweaks;
    };
    toggle.addEventListener('click', flip);
    toggle.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  });

  // Claude API config
  const claudeKey   = root.querySelector('#claude-key');
  const claudeModel = root.querySelector('#claude-model');
  const claudeTog   = root.querySelector('#claude-toggle');
  const claudeMsg   = root.querySelector('#claude-msg');
  let _claudeKeyDirty = false;
  claudeKey?.addEventListener('focus', () => { if (claudeKey.value.includes('…')) { claudeKey.value = ''; _claudeKeyDirty = true; } });
  claudeKey?.addEventListener('input', () => { _claudeKeyDirty = true; });
  claudeTog?.addEventListener('click', () => claudeTog.classList.toggle('is-on'));
  claudeTog?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); claudeTog.classList.toggle('is-on'); } });
  root.querySelector('#claude-save')?.addEventListener('click', async () => {
    const cur = await loadClaudeConfig();
    const next = {
      ...cur,
      apiKey: _claudeKeyDirty ? claudeKey.value.trim() : cur.apiKey,
      model: claudeModel.value,
      enabled: claudeTog.classList.contains('is-on'),
    };
    await saveClaudeConfig(next);
    claudeMsg.textContent = 'saved.';
    root.querySelector('#claude-status').textContent = next.enabled && next.apiKey ? 'enabled' : 'disabled';
    root.querySelector('#claude-status').classList.toggle('emerald', next.enabled && next.apiKey);
    setTimeout(() => { claudeMsg.textContent = ''; }, 2000);
  });
  root.querySelector('#claude-test')?.addEventListener('click', async () => {
    claudeMsg.textContent = 'testing...';
    try {
      const { askClaude } = await import('../claude-client.js');
      const { text } = await askClaude('reply with exactly: connection ok', { maxTokens: 50 });
      claudeMsg.textContent = '✓ ' + text.slice(0, 80);
    } catch (err) {
      claudeMsg.textContent = '✗ ' + err.message.slice(0, 120);
    }
  });

  // Anchor nav — smooth scroll to section
  root.querySelectorAll('.settings-anchor-nav a[data-anchor]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = root.querySelector('#' + a.dataset.anchor);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.classList.add('is-flash');
        setTimeout(() => target.classList.remove('is-flash'), 1200);
      }
    });
  });

  // Open moji (bitmoji) page
  root.querySelector('#moji-open')?.addEventListener('click', () => navigate('/bitmoji'));

  // Feedback form — dynamic placeholder + save to IDB + open mailto
  const PROMPTS = {
    feature: 'please share the tool name and how you\'d use it.',
    bug:     'what happened · what you expected · browser · device',
    idea:    'the idea · why it matters · how you\'d use it',
    prayer:  'subject · context · how we can stand with you',
    other:   'leave a note. anything on your heart.',
  };
  const fbKind   = root.querySelector('#fb-kind');
  const fbMsg    = root.querySelector('#fb-msg');
  const fbStatus = root.querySelector('#fb-status');
  const fbCard   = root.querySelector('#feedback-card');
  const fbSend   = root.querySelector('#fb-send');
  const SEND_LABELS = {
    feature: 'share feedback',
    bug: 'send bug report',
    idea: 'send idea',
    prayer: 'send prayer request',
    other: 'send note',
  };
  const updateFeedbackUi = () => {
    fbMsg.placeholder = PROMPTS[fbKind.value] || PROMPTS.other;
    if (fbSend) fbSend.textContent = SEND_LABELS[fbKind.value] || SEND_LABELS.other;
  };
  fbKind?.addEventListener('change', updateFeedbackUi);
  updateFeedbackUi();
  root.querySelector('#fb-close')?.addEventListener('click', () => {
    fbCard.style.display = 'none';
  });
  fbSend?.addEventListener('click', async () => {
    const msg = (fbMsg.value || '').trim();
    if (!msg) {
      fbStatus.textContent = 'add a message first';
      fbStatus.style.color = 'var(--ruby)';
      return;
    }
    const kind = fbKind.value || 'other';
    const { put: putStore, ulid } = await import('../store.js');
    const row = {
      id: ulid(),
      kind,
      message: msg,
      status: 'new',
      browser: navigator.userAgent.slice(0, 200),
      route: location.hash,
      createdAt: new Date().toISOString(),
    };
    let savedLocal = false;
    try {
      await putStore('feedback', row);
      savedLocal = true;
    } catch (err) {
      console.warn('feedback local save failed', err);
    }
    // Also open a mailto so it actually reaches support
    const subjMap = {
      feature: '%5BMiracle%5D%20Feature%20Request',
      bug:     '%5BMiracle%5D%20Bug%20Report',
      idea:    '%5BMiracle%5D%20Idea',
      prayer:  '%5BMiracle%5D%20Prayer%20Request',
      other:   '%5BMiracle%5D%20Feedback',
    };
    const body = encodeURIComponent(msg + '\n\n— sent from miracle · ' + new Date().toISOString().slice(0, 10));
    const mailto = `mailto:cc@miracleapp.site?subject=${subjMap[kind]}&body=${body}`;
    // Visual confirm
    fbStatus.textContent = savedLocal ? 'saved locally. opening mail client...' : 'opening mail client...';
    fbStatus.style.color = 'var(--emerald)';
    fbMsg.value = '';
    setTimeout(() => { window.location.href = mailto; }, 400);
    setTimeout(() => { fbStatus.textContent = ''; }, 4000);
  });

  // Contact copy
  root.querySelector('#contact-copy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('cc@miracleapp.site');
      const btn = root.querySelector('#contact-copy');
      const orig = btn.textContent;
      btn.textContent = '✓ copied';
      btn.style.color = 'var(--emerald)';
      setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1500);
    } catch { /* fallback */ }
  });

  // Notifications
  const notifTog = root.querySelector('#notif-toggle');
  notifTog?.addEventListener('click', () => {
    const on = !notifTog.classList.contains('is-on');
    notifTog.classList.toggle('is-on', on);
    notifSet(on);
  });
  notifTog?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); notifTog.click(); } });
  root.querySelector('#notif-grant')?.addEventListener('click', async () => {
    const p = await notifReq();
    const row = notifTog?.parentElement?.previousElementSibling?.querySelector('span:last-child');
    if (row) row.textContent = p;
    if (p === 'granted') row?.classList.add('emerald');
  });
  root.querySelector('#notif-test')?.addEventListener('click', () => {
    notifSet(true);
    notifTog?.classList.add('is-on');
    notifSend('miracle is listening', { body: 'streak warnings & event reminders are wired up. you will get a ping when it matters.' });
  });

  // Sound toggle
  const soundToggle = root.querySelector('#sound-toggle');
  if (soundToggle) {
    const flip = () => {
      const on = localStorage.getItem('miracle_sound') === '1';
      localStorage.setItem('miracle_sound', on ? '0' : '1');
      soundToggle.classList.toggle('is-on', !on);
    };
    soundToggle.addEventListener('click', flip);
    soundToggle.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  }

  // Focus toggle
  const focusToggle = root.querySelector('#focus-toggle');
  if (focusToggle) {
    const flip = () => {
      const on = document.body.classList.toggle('focus-mode');
      sessionStorage.setItem('miracle_focus_mode', on ? '1' : '0');
      focusToggle.classList.toggle('is-on', on);
    };
    focusToggle.addEventListener('click', flip);
    focusToggle.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
  }

  root.querySelector('#tour-replay')?.addEventListener('click', () => {
    localStorage.removeItem('miracle_welcome_tour_v1');
    navigate('/dashboard');
    setTimeout(() => window.startMiracleTour?.(), 500);
  });

  // Streak summary
  const summary = root.querySelector('#streak-summary');
  if (summary) {
    const domains = ['dreams','ideas','bible','prayer','fasting','plans','projects','tasks',
      'schedule','finance','meals','testimony','music','people','books','blog','quizzes'];
    const rows = [];
    for (const d of domains) {
      try {
        const s = JSON.parse(localStorage.getItem(`miracle_streaks_${d}`));
        if (s && s.current > 0) {
          rows.push(`<div class="settings-row"><span>${d}</span><span class="num">${s.current}d · best ${s.longest}d</span></div>`);
        }
      } catch { /* skip */ }
    }
    summary.innerHTML = rows.length ? rows.join('') : '<div class="meta">no active streaks yet</div>';
  }

  // Verify-email resend button (only present when the banner is shown)
  root.querySelector('#verify-resend')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'sending…';
    try {
      const r = await sendVerificationEmail();
      btn.textContent = r.alreadyVerified ? 'already verified' : 'sent ✓ check inbox';
      // Refresh user profile to pick up any state change
      refreshMe().catch(() => {});
    } catch (err) {
      btn.textContent = 'try again';
      btn.disabled = false;
      const banner = root.querySelector('#verify-banner');
      if (banner) banner.querySelector('.meta').textContent = err.message;
    }
  });

  return root;
}

export function applyPrefs(prefs) {
  if (!prefs) return;
  const html = document.documentElement;
  if (prefs.theme) html.setAttribute('data-theme', normalizeTheme(prefs.theme));
  if (prefs.mode)  html.setAttribute('data-mode',  prefs.mode);
  for (const [k, v] of Object.entries(prefs.tweaks || {})) {
    const attr = 'data-tweak-' + k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
    html.setAttribute(attr, String(v));
  }
}

export async function loadAndApplyPrefs() {
  const { get } = await import('../store.js');
  const row = await get('meta', 'prefs');
  applyPrefs(row?.value || { theme: 'eden-night', mode: 'minimalist', tweaks: { animations: 'on' } });
}

function normalizeTheme(theme) {
  return THEME_ALIASES[theme] || theme || 'eden-night';
}

function once(fn) { let done = false; return (...a) => { if (done) return; done = true; fn(...a); }; }
