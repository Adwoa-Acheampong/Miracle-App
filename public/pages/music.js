import { all } from '../store.js';
import { openDrawer } from '../drawer.js';
import { icon } from '../icons.js';

import { esc } from '../util/esc.js';
export async function render() {
  const items = (await all('music')).sort((a, b) => (b.date || b.updatedAt || '').localeCompare(a.date || a.updatedAt || ''));

  // Spotify-style aggregates
  const artistCount = {};
  const songCount   = {};
  const genreCount  = {};
  for (const m of items) {
    if (m.artist) artistCount[m.artist] = (artistCount[m.artist] || 0) + 1;
    if (m.title)  songCount[m.title]   = (songCount[m.title]   || 0) + 1;
    if (m.genre)  genreCount[m.genre]  = (genreCount[m.genre]  || 0) + 1;
  }
  const topArtist = top(artistCount);
  const topSong   = top(songCount);
  const topGenre  = top(genreCount);
  const artists   = Object.keys(artistCount).length;

  const root = document.createElement('div');
  root.className = 'page page-wide';
  root.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">music</h1>
      <span class="page-meta">${items.length} songs · ${artists} artists</span>
    </div>

    <div class="music-wrapped">
      ${wrappedCard('top artist',   topArtist?.key || '—', topArtist?.n,  '#34D399', 'music')}
      ${wrappedCard('most played',  topSong?.key   || '—', topSong?.n,    '#60A5FA', 'sparkles')}
      ${wrappedCard('top genre',    topGenre?.key  || '—', topGenre?.n,   '#7B5EA7', 'flame')}
      ${wrappedCard('total plays',  String(items.length), null,           '#F59E0B', 'star')}
    </div>

    ${topArtist ? `
      <section class="dash-section">
        <div class="label">most listened · top 5 artists</div>
        <div class="music-bars">
          ${Object.entries(artistCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n], i) => `
            <div class="music-bar-row" style="--idx:${i}">
              <span class="music-bar-rank num">#${i + 1}</span>
              <span class="music-bar-name">${esc(name)}</span>
              <span class="music-bar-track"><span style="width: ${(n / topArtist.n * 100).toFixed(0)}%"></span></span>
              <span class="music-bar-num">${n}</span>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="dash-section">
        <div class="label">most played · top 5 songs</div>
        <div class="music-bars">
          ${Object.entries(songCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n], i) => `
            <div class="music-bar-row" style="--idx:${i}">
              <span class="music-bar-rank num">#${i + 1}</span>
              <span class="music-bar-name">"${esc(name)}"</span>
              <span class="music-bar-track"><span style="width: ${(n / topSong.n * 100).toFixed(0)}%; background: linear-gradient(90deg, #60A5FA, #2563EB)"></span></span>
              <span class="music-bar-num">${n}</span>
            </div>
          `).join('')}
        </div>
      </section>
    ` : ''}

    <p class="meta" style="margin: 32px 0 12px; font-style: italic;">ephesians 5:19 — "speak to one another with psalms, hymns, and spiritual songs."</p>

    ${items.length === 0 ? `
      <div class="empty"><code>/music "Way Maker" by Sinach · during morning prayer</code></div>
    ` : `
      <section class="dash-section">
        <div class="label">recent · ${items.length}</div>
        <ul class="entry-list">
          ${items.slice(0, 60).map(m => `
            <li class="entry-row" data-id="${m.id}">
              <span class="dot" style="background: #34D399"></span>
              <span class="title">"${esc(m.title)}" <span class="meta">· ${esc(m.artist || '—')}${m.heard ? ' · ' + esc(m.heard) : ''}${m.genre ? ' · ' + esc(m.genre) : ''}</span></span>
              <span class="meta-id">${(m.date || '').slice(0, 10)}</span>
            </li>
          `).join('')}
        </ul>
      </section>
    `}
  `;
  root.querySelectorAll('.entry-row').forEach(r => r.addEventListener('click', () => openDrawer('music', r.dataset.id)));
  window.addEventListener('drawer:close', once(() => { if (root.isConnected) reload(); }), { once: true });
  return root;
}

function wrappedCard(label, value, badge, color, ic) {
  return `
    <div class="wrapped-card" style="--accent:${color}">
      <div class="wrapped-icon">${icon(ic, { size: 22 })}</div>
      <div class="wrapped-label">${label}</div>
      <div class="wrapped-value">${esc(value)}</div>
      ${badge ? `<div class="wrapped-badge">${badge} ${badge === 1 ? 'play' : 'plays'}</div>` : ''}
    </div>
  `;
}

function top(map) {
  const entries = Object.entries(map);
  if (entries.length === 0) return null;
  const [key, n] = entries.reduce((best, cur) => cur[1] > best[1] ? cur : best);
  return { key, n };
}

function reload() { const h = location.hash; location.hash = '#/'; setTimeout(() => location.hash = h, 0); }
function once(fn) { let done = false; return (...a) => { if (done) return; done = true; fn(...a); }; }
