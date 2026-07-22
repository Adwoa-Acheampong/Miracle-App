// finance.js — Stewardship ledger with full visual ramp.

import { all, get, put, ulid } from '../store.js';
import { openDrawer } from '../drawer.js';
import { navigate } from '../router.js';

import { esc } from '../util/esc.js';
const MS_PER_WEEK = 604800000;

export async function render() {
  const [txs, budgets] = await Promise.all([
    all('transactions').then(r => r.sort((a, b) => (b.date || '').localeCompare(a.date || ''))).catch(() => []),
    all('budgets').catch(() => []),
  ]);

  const month = new Date().toISOString().slice(0, 7);
  const monthTx = txs.filter(t => (t.date || '').startsWith(month));
  const inflow  = sumDir(monthTx, 'in');
  const outflow = sumDir(monthTx, 'out');
  const net     = inflow - outflow;
  const allInflow  = sumDir(txs, 'in');
  const tithed     = txs.filter(t => t.tithe === 'yes' || t.tithe === true).reduce((s, t) => s + Number(t.amountGhs || 0), 0);
  const titheRatio = allInflow > 0 ? (tithed / allInflow * 100) : 0;

  const dayCount = new Date().getDate();
  const dailyAvg = dayCount > 0 ? outflow / dayCount : 0;

  // Today's summary
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTx  = txs.filter(t => (t.date || '') === todayStr);
  const todayIn  = sumDir(todayTx, 'in');
  const todayOut = sumDir(todayTx, 'out');
  const todayNet = todayIn - todayOut;
  const todayTithe = todayTx.filter(t => t.tithe === 'yes' || t.tithe === true).reduce((s, t) => s + Number(t.amountGhs || 0), 0);

  // Daily bars - last 14 days
  const dayBars = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dStr = d.toISOString().slice(0, 10);
    const sub = txs.filter(t => (t.date || '') === dStr);
    const inS  = sumDir(sub, 'in');
    const outS = sumDir(sub, 'out');
    dayBars.push({ date: dStr, label: d.toLocaleDateString(undefined, { weekday: 'short' })[0], inS, outS, net: inS - outS });
  }
  const dayMax = Math.max(1, ...dayBars.map(b => Math.max(b.inS, b.outS, Math.abs(b.net))));

  // Tag-based category aggregation (uses category field too)
  const byCat = {};
  monthTx.filter(t => t.direction === 'out').forEach(t => {
    const c = t.category || 'misc';
    byCat[c] = (byCat[c] || 0) + Number(t.amountGhs || 0);
  });
  const sortedCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const topCats = sortedCats.slice(0, 6);
  const moreCats = sortedCats.length - 6;
  const maxCat = topCats.length ? topCats[0][1] : 1;

  // 12-month trend
  const months = monthlyTrend(txs, 12);

  // Stewardship score
  const positiveWeeks = countPositiveWeeks(txs, 12);
  const totalWeeks = 12;
  const txThisWeek = txs.filter(t => isThisWeek(t.date)).length;
  const stewardship = Math.min(100, Math.round(
    (Math.min(1, titheRatio / 10) * 40) +
    ((positiveWeeks / totalWeeks) * 30) +
    (txThisWeek > 0 ? 30 : 0)
  ));
  const titheStreak = countTitheStreak(txs);

  // Group transactions by date
  const txByDate = groupByDate(txs.slice(0, 300));

  const root = document.createElement('div');
  root.className = 'page page-wide fin-page';
  root.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">finance</h1>
      <span class="page-meta">${txs.length} tx · ${monthTx.length} this month</span>
    </div>

    ${renderMilestoneBanner(txs, titheRatio, positiveWeeks)}

    <section class="fin-today">
      <div class="fin-today-head">
        <span class="fin-today-label">today</span>
        <span class="fin-today-date">${esc(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase())}</span>
      </div>
      <div class="fin-today-grid">
        <div class="fin-today-cell"><span class="fin-today-k">IN</span><span class="fin-today-v emerald">+${money(todayIn)}</span></div>
        <div class="fin-today-cell"><span class="fin-today-k">OUT</span><span class="fin-today-v clay">−${money(todayOut)}</span></div>
        <div class="fin-today-cell"><span class="fin-today-k">NET</span><span class="fin-today-v ${todayNet >= 0 ? 'emerald' : 'ruby'}">${todayNet >= 0 ? '+' : '−'}${money(Math.abs(todayNet))}</span></div>
        <div class="fin-today-cell"><span class="fin-today-k">TITHE</span><span class="fin-today-v gold">${money(todayTithe)}</span></div>
        <div class="fin-today-cell"><span class="fin-today-k">TX</span><span class="fin-today-v">${todayTx.length}</span></div>
      </div>
    </section>

    <section class="fin-hero">
      <div class="fin-hero-net">
        <div class="fin-hero-net-label">NET · ${esc(month)}</div>
        <div class="fin-hero-net-num ${net > 0 ? 'is-pos' : net < 0 ? 'is-neg' : 'is-zero'}">
          ${net >= 0 ? '+' : '−'}GHS ${money(Math.abs(net))}
        </div>
        <div class="fin-hero-health">
          spending GHS ${money(dailyAvg.toFixed(0))}/day avg · tithe ${titheRatio.toFixed(1)}% · ${titheRatio >= 10 ? 'on track' : 'at risk'}
        </div>
      </div>
      <div class="fin-hero-pills">
        <div class="fin-pill"><span class="fin-pill-label">IN</span><span class="fin-pill-val emerald">+${money(inflow)}</span></div>
        <div class="fin-pill"><span class="fin-pill-label">OUT</span><span class="fin-pill-val clay">−${money(outflow)}</span></div>
        <div class="fin-pill"><span class="fin-pill-label">NET</span><span class="fin-pill-val ${net >= 0 ? 'emerald' : 'ruby'}">${net >= 0 ? '+' : '−'}${money(Math.abs(net))}</span></div>
        <div class="fin-pill"><span class="fin-pill-label">TITHE</span><span class="fin-pill-val gold">${titheRatio.toFixed(0)}%</span></div>
      </div>
    </section>

    <section class="fin-row-two">
      ${renderCashflowArc(inflow, outflow, net)}
      ${renderTitheRing(titheRatio)}
    </section>

    <section class="dash-section">
      <div class="label">stewardship score</div>
      ${renderStewardshipScore(stewardship, titheStreak, positiveWeeks, totalWeeks, dailyAvg)}
    </section>

    <section class="dash-section">
      <div class="label">category breakdown · ${esc(month)}</div>
      ${renderCategoryBreakdown(topCats, moreCats, maxCat, outflow)}
    </section>

    <section class="dash-section">
      <div class="label">monthly trend · last 12 months</div>
      ${renderMonthlyTrend(months)}
    </section>

    <section class="dash-section">
      <div class="label">daily flow · last 14 days</div>
      ${renderDailyBars(dayBars, dayMax)}
    </section>

    ${budgets.length > 0 ? `
      <section class="dash-section">
        <div class="label">budget vs actual</div>
        ${renderBudgetCards(budgets, byCat)}
      </section>
    ` : ''}

    <section class="dash-section">
      <div class="command-hint" id="cmd-hint">
        <div class="command-hint-row" id="cmd-hint-row">
          <button class="cmd-toggle" id="cmd-toggle" aria-expanded="false">▸ command syntax</button>
          <div class="cmd-quick">
            <button class="btn cmd-quick-btn" data-quick="earn">+ earn</button>
            <button class="btn cmd-quick-btn" data-quick="spend">+ spend</button>
          </div>
        </div>
        <pre class="cmd-syntax" id="cmd-syntax" hidden>/spend GHS [amount] [label] #[tag] @[person]
/earn  GHS [amount] [label] #[tag]</pre>
      </div>
    </section>

    <section class="dash-section">
      <div class="label">transactions</div>
      ${txs.length === 0 ? renderEmptyLedger() : renderTransactionList(txByDate)}
    </section>
  `;

  // Bindings
  root.querySelectorAll('.tx-row').forEach(row => {
    row.addEventListener('click', () => openDrawer('transactions', row.dataset.id));
  });
  root.querySelector('#cmd-toggle')?.addEventListener('click', () => {
    const pre = root.querySelector('#cmd-syntax');
    const open = pre.hasAttribute('hidden') ? false : true;
    if (open) pre.setAttribute('hidden', '');
    else      pre.removeAttribute('hidden');
    root.querySelector('#cmd-toggle').setAttribute('aria-expanded', String(!open));
    root.querySelector('#cmd-toggle').textContent = (!open ? '▾ command syntax' : '▸ command syntax');
  });
  root.querySelectorAll('.cmd-quick-btn').forEach(b => {
    b.addEventListener('click', async () => {
      const direction = b.dataset.quick === 'earn' ? 'in' : 'out';
      const entry = {
        id: ulid(),
        date: new Date().toISOString().slice(0, 10),
        direction,
        amountGhs: 0,
        account: 'MoMo',
        venture: 'Personal',
        category: 'misc',
        tithe: 'no',
        payee: '',
      };
      await put('transactions', entry);
      openDrawer('transactions', entry.id);
    });
  });
  root.querySelectorAll('.milestone-dismiss').forEach(b => {
    b.addEventListener('click', () => {
      const list = JSON.parse(localStorage.getItem('miracle_dismissed_milestones') || '[]');
      list.push(b.dataset.milestone);
      localStorage.setItem('miracle_dismissed_milestones', JSON.stringify(list));
      b.closest('.milestone-banner')?.remove();
    });
  });
  root.querySelector('.empty-cta')?.addEventListener('click', () => {
    const head = root.querySelector('.page-head');
    const newBtn = head.querySelector('.new-btn');
    if (newBtn) newBtn.click();
  });
  root.querySelector('.budget-cta')?.addEventListener('click', async () => {
    const id = ulid();
    await put('budgets', { id, period: month, category: 'food', limitGhs: 800 });
    openDrawer('budgets', id);
  });
  window.addEventListener('drawer:close', once(() => { if (root.isConnected) reload(); }), { once: true });

  return root;
}

// ═══ MILESTONES ═══

function renderMilestoneBanner(txs, titheRatio, positiveWeeks) {
  const dismissed = new Set(JSON.parse(localStorage.getItem('miracle_dismissed_milestones') || '[]'));
  const checks = [];
  if (txs.length >= 1) checks.push({ key: 'fin-ledger-opened', glyph: '✦', text: 'ledger opened · welcome to stewardship' });
  if (txs.length >= 50) checks.push({ key: 'fin-50-entries', glyph: '◆', text: '50 entries · faithful ledger keeper' });
  if (titheRatio >= 10) checks.push({ key: 'fin-tithe-faithful', glyph: '✝', text: 'tithe faithful this month' });
  if (positiveWeeks >= 4) checks.push({ key: 'fin-4-surplus', glyph: '↑', text: '4 weeks in surplus' });
  if (countLoggingStreak(txs) >= 7) checks.push({ key: 'fin-7-streak', glyph: '🔥', text: '7 days of faithful tracking' });
  const next = checks.find(m => !dismissed.has(m.key));
  if (!next) return '';
  return `
    <div class="milestone-banner">
      <span class="milestone-glyph">${next.glyph}</span>
      <span class="milestone-text">${esc(next.text)}</span>
      <button class="milestone-dismiss" data-milestone="${next.key}" aria-label="dismiss">×</button>
    </div>
  `;
}

// ═══ CASHFLOW ARC ═══

function renderCashflowArc(inflow, outflow, net) {
  const total = inflow + outflow;
  const inflowDeg = total > 0 ? (inflow / total) * 180 : 0;
  const outflowDeg = total > 0 ? (outflow / total) * 180 : 0;
  const r = 80, cx = 110, cy = 95;
  const circumference = Math.PI * r;
  const inflowDash = (inflowDeg / 180) * circumference;
  const outflowDash = (outflowDeg / 180) * circumference;
  const hasData = total > 0;

  return `
    <div class="cashflow-arc">
      <svg viewBox="0 0 220 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="inflowGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#10B981" stop-opacity="${hasData ? 0.95 : 0.2}"/>
            <stop offset="100%" stop-color="#34D399" stop-opacity="${hasData ? 0.85 : 0.2}"/>
          </linearGradient>
          <linearGradient id="outflowGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#B5674D" stop-opacity="${hasData ? 0.95 : 0.2}"/>
            <stop offset="100%" stop-color="#D4856A" stop-opacity="${hasData ? 0.85 : 0.2}"/>
          </linearGradient>
        </defs>
        <!-- Track -->
        <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}"
              fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12" stroke-linecap="round"/>
        <!-- Inflow arc -->
        <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}"
              fill="none" stroke="url(#inflowGrad)" stroke-width="12" stroke-linecap="round"
              stroke-dasharray="${inflowDash} ${circumference}"
              stroke-dashoffset="0" class="arc-stroke"/>
        <!-- Outflow arc (offset) -->
        <path d="M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}"
              fill="none" stroke="url(#outflowGrad)" stroke-width="12" stroke-linecap="round"
              stroke-dasharray="${outflowDash} ${circumference}"
              stroke-dashoffset="-${inflowDash + 4}" class="arc-stroke"/>
        <!-- Center label (positioned to clear arc + avoid overlap) -->
        <text x="${cx}" y="${cy - 28}" text-anchor="middle" font-size="8" font-family="JetBrains Mono, monospace" fill="rgba(255,255,255,0.5)" letter-spacing="2">NET</text>
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="20" font-family="Inter, sans-serif" fill="${net >= 0 ? '#10B981' : '#C0392B'}" font-weight="300">${net >= 0 ? '+' : '−'}${money(Math.abs(net))}</text>
      </svg>
      <div class="arc-legend">
        <span><span class="arc-dot" style="background:#10B981"></span>INFLOW  GHS ${money(inflow)}</span>
        <span><span class="arc-dot" style="background:#B5674D"></span>OUTFLOW GHS ${money(outflow)}</span>
      </div>
      ${hasData ? '' : `<div class="arc-empty">+ log your first transaction</div>`}
    </div>
  `;
}

// ═══ TITHE RING ═══

function renderTitheRing(rate) {
  const r = 50, cx = 70, cy = 70;
  const circumference = 2 * Math.PI * r;
  const dash = Math.min(100, rate) / 100 * circumference;
  const glow = rate >= 10 ? 'is-faithful' : '';
  const shortfall = rate < 10 ? (10 - rate) : 0;

  return `
    <div class="tithe-ring ${glow}">
      <svg viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
                stroke="var(--color-gold)" stroke-width="10" stroke-linecap="round"
                transform="rotate(-90 ${cx} ${cy})"
                stroke-dasharray="${dash} ${circumference}"/>
        ${shortfall > 0 ? `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
                  stroke="rgba(192,57,43,0.55)" stroke-width="3"
                  transform="rotate(${(dash / circumference) * 360 - 90} ${cx} ${cy})"
                  stroke-dasharray="6 ${circumference}"/>
        ` : ''}
        <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="22" font-family="Inter, sans-serif" font-weight="300" fill="var(--color-gold)">${rate.toFixed(0)}%</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="8" font-family="JetBrains Mono, monospace" fill="rgba(255,255,255,0.45)" letter-spacing="2">TITHE</text>
      </svg>
    </div>
  `;
}

// ═══ STEWARDSHIP SCORE ═══

function renderStewardshipScore(score, titheStreak, posWeeks, totalWeeks, dailyAvg) {
  return `
    <div class="stewardship">
      <div class="stewardship-gauge">
        <div class="stewardship-fill" style="height: ${score}%"></div>
        <div class="stewardship-target" title="target 70"></div>
        <div class="stewardship-num">${score}</div>
        <div class="stewardship-cap">/ 100</div>
      </div>
      <div class="stewardship-meta">
        <div class="sm-row"><span class="sm-label">tithe streak</span><span class="sm-val num">${titheStreak}w</span></div>
        <div class="sm-row"><span class="sm-label">positive weeks</span><span class="sm-val num">${posWeeks}/${totalWeeks}</span></div>
        <div class="sm-row"><span class="sm-label">avg daily spend</span><span class="sm-val num">GHS ${money(dailyAvg.toFixed(0))}</span></div>
      </div>
    </div>
  `;
}

// ═══ CATEGORY BREAKDOWN ═══

function renderCategoryBreakdown(topCats, more, maxCat, totalOut) {
  if (topCats.length === 0) {
    return `
      <div class="cat-empty">
        ${[1,2,3].map(() => `
          <div class="cat-row is-empty">
            <span class="cat-name">— — —</span>
            <span class="cat-bar"><span style="width: 35%"></span></span>
            <span class="cat-val">—</span>
          </div>
        `).join('')}
        <div class="cat-empty-hint">start tracking your spending</div>
      </div>
    `;
  }
  return `
    <div class="cat-rows">
      ${topCats.map(([c, v], i) => {
        const pct = maxCat > 0 ? (v / maxCat * 100) : 0;
        const pctOfTotal = totalOut > 0 ? (v / totalOut * 100) : 0;
        return `
          <div class="cat-row" style="--idx:${i}">
            <span class="cat-name">${esc(c)}</span>
            <span class="cat-bar">
              <span style="width: ${pct.toFixed(0)}%; transition-delay: ${i * 80}ms;"></span>
            </span>
            <span class="cat-val num">GHS ${money(v)} <span class="cat-pct">${pctOfTotal.toFixed(0)}%</span></span>
          </div>
        `;
      }).join('')}
      ${more > 0 ? `<div class="cat-more">+ ${more} more</div>` : ''}
    </div>
  `;
}

// ═══ DAILY BARS (14-day grouped bar chart) ═══

function renderDailyBars(bars, max) {
  return `
    <div class="daily-bars-chart">
      <div class="db-legend">
        <span><i style="background:var(--color-emerald)"></i> in</span>
        <span><i style="background:var(--color-clay)"></i> out</span>
      </div>
      <div class="db-bars">
        ${bars.map((b, i) => `
          <div class="db-col" title="${esc(b.date)} · in GHS ${money(b.inS)} · out GHS ${money(b.outS)}" style="--d:${i * 40}ms">
            <div class="db-stack">
              <span class="db-bar in"  style="height: ${(b.inS / max) * 100}%"></span>
              <span class="db-bar out" style="height: ${(b.outS / max) * 100}%"></span>
            </div>
            <div class="db-label">${b.label}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ═══ MONTHLY TREND ═══

function renderMonthlyTrend(months) {
  const max = Math.max(1, ...months.map(m => Math.abs(m.net)));
  const now = new Date();
  const curIdx = months.length - 1;
  return `
    <div class="month-trend">
      <div class="mt-zero"></div>
      <div class="mt-bars">
        ${months.map((m, i) => {
          const h = Math.min(100, (Math.abs(m.net) / max) * 100);
          const isPos = m.net >= 0;
          const isCurrent = i === curIdx;
          return `
            <div class="mt-bar-wrap" title="${esc(m.label)} · in ${money(m.in)} · out ${money(m.out)} · net ${money(m.net)}" style="--delay: ${i * 50}ms">
              <div class="mt-bar ${isPos ? 'pos' : 'neg'} ${isCurrent ? 'is-current' : ''}" style="height: ${h}%"></div>
              ${isCurrent ? `<span class="mt-current-dot"></span>` : ''}
              <div class="mt-bar-label">${esc(m.short)}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ═══ BUDGET CARDS ═══

function renderBudgetCards(budgets, byCat) {
  return `
    <div class="budget-cards">
      ${budgets.map(b => {
        const spent = byCat[b.category] || 0;
        const pct = b.limitGhs > 0 ? Math.min(200, (spent / b.limitGhs * 100)) : 0;
        const klass = pct >= 100 ? 'is-over' : pct >= 80 ? 'is-warn' : 'is-ok';
        return `
          <div class="budget-card ${klass}">
            <div class="budget-head">
              <span class="budget-cat">${esc(b.category)}</span>
              <span class="budget-num num">GHS ${money(spent.toFixed(0))} / ${money(b.limitGhs)}</span>
            </div>
            <div class="budget-bar"><span style="width: ${Math.min(100, pct).toFixed(0)}%"></span></div>
            <div class="budget-pct num">${pct.toFixed(0)}%</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ═══ TRANSACTION LIST ═══

function renderTransactionList(txByDate) {
  return `
    <div class="tx-list">
      ${Object.entries(txByDate).map(([date, group]) => `
        <div class="tx-date-header">${formatTxDate(date)}</div>
        ${group.map(t => `
          <div class="tx-row ${t.direction === 'in' ? 'tx-in' : 'tx-out'}" data-id="${t.id}">
            <span class="tx-icon">${t.direction === 'in' ? '▲' : '▼'}</span>
            <span class="tx-label">${esc(t.payee || '(unlabeled)')}</span>
            <span class="tx-tags">
              ${t.category ? `<span class="tx-tag">${esc(t.category)}</span>` : ''}
              ${(t.tithe === 'yes' || t.tithe === true) ? `<span class="tx-tag gold">tithe</span>` : ''}
              ${t.venture && t.venture !== 'Personal' ? `<span class="tx-tag">${esc(t.venture)}</span>` : ''}
            </span>
            <span class="tx-date">${esc((t.date || '').slice(5))}</span>
            <span class="tx-amount ${t.direction === 'in' ? 'pos' : 'neg'}">${t.direction === 'in' ? '+' : '−'}GHS ${money(t.amountGhs)}</span>
          </div>
        `).join('')}
      `).join('')}
    </div>
  `;
}

function renderEmptyLedger() {
  return `
    <div class="ledger-empty">
      <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="40" cy="40" r="22" fill="none" stroke="var(--color-clay)" stroke-width="2" opacity="0.45"/>
        <circle cx="40" cy="40" r="14" fill="none" stroke="var(--color-clay)" stroke-width="1.5" opacity="0.3"/>
        <line x1="40" y1="30" x2="40" y2="50" stroke="var(--color-clay)" stroke-width="2.5" stroke-linecap="round"/>
        <line x1="30" y1="40" x2="50" y2="40" stroke="var(--color-clay)" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
      <div class="ledger-empty-title">your ledger is clean</div>
      <div class="ledger-empty-hint">log your first transaction</div>
      <button class="btn is-primary empty-cta" style="margin-top: var(--sp-3)">+ new</button>
    </div>
  `;
}

// ═══ HELPERS ═══

function sumDir(arr, dir) {
  return arr.filter(t => t.direction === dir).reduce((s, t) => s + Number(t.amountGhs || 0), 0);
}

function monthlyTrend(txs, count) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthTx = txs.filter(t => (t.date || '').startsWith(key));
    const inSum = sumDir(monthTx, 'in');
    const outSum = sumDir(monthTx, 'out');
    out.push({
      key,
      label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      short: d.toLocaleDateString(undefined, { month: 'short' }).toLowerCase(),
      in: inSum, out: outSum, net: inSum - outSum,
    });
  }
  return out;
}

function countPositiveWeeks(txs, weeks) {
  const now = Date.now();
  let count = 0;
  for (let w = 0; w < weeks; w++) {
    const end = now - w * MS_PER_WEEK;
    const start = end - MS_PER_WEEK;
    const wkTx = txs.filter(t => {
      const ts = new Date(t.date || 0).getTime();
      return ts >= start && ts < end;
    });
    const net = sumDir(wkTx, 'in') - sumDir(wkTx, 'out');
    if (net > 0) count++;
  }
  return count;
}

function countLoggingStreak(txs) {
  const dates = new Set(txs.map(t => t.date).filter(Boolean));
  let n = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (dates.has(d.toISOString().slice(0, 10))) n++;
    else if (i > 0) break;
  }
  return n;
}

function countTitheStreak(txs) {
  const titheByMonth = {};
  txs.forEach(t => {
    const m = (t.date || '').slice(0, 7);
    if (!m) return;
    titheByMonth[m] = titheByMonth[m] || { in: 0, tithed: 0 };
    if (t.direction === 'in') titheByMonth[m].in += Number(t.amountGhs || 0);
    if (t.tithe === 'yes' || t.tithe === true) titheByMonth[m].tithed += Number(t.amountGhs || 0);
  });
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const row = titheByMonth[key];
    if (row && row.in > 0 && (row.tithed / row.in) >= 0.10) streak++;
    else if (i > 0) break;
  }
  return Math.round(streak * 4.33);  // approximate weeks
}

function isThisWeek(dateStr) {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  return Date.now() - t < MS_PER_WEEK;
}

function groupByDate(txs) {
  const out = {};
  for (const t of txs) {
    const d = t.date || 'undated';
    if (!out[d]) out[d] = [];
    out[d].push(t);
  }
  return out;
}

function formatTxDate(d) {
  if (d === 'undated') return 'undated';
  try {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).toLowerCase();
  } catch { return d; }
}

function money(n) { return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 }); }
function reload() { const h = location.hash; location.hash = '#/'; setTimeout(() => location.hash = h, 0); }
function once(fn) { let done = false; return (...a) => { if (done) return; done = true; fn(...a); }; }
