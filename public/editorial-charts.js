import { esc } from './util/esc.js';
// editorial-charts.js — chart/table builders in the Fund24-application layout pattern.
// Themed in the Miracle emerald palette via CSS classes.

// ═══ Section header wrapper ═══

export function edSection({ code, sub, title, badgeLabel, badgeVal, body }) {
  return `
    <section class="ed-section">
      <div class="ed-head">
        <div class="ed-head-left">
          <div class="ed-section-code"><span class="ed-code-num">${esc(code)}</span></div>
          ${sub ? `<div class="ed-section-sub">${esc(sub)}</div>` : ''}
          <h2 class="ed-title">${title}</h2>
        </div>
        ${badgeVal ? `
          <div class="ed-head-right">
            <div class="ed-badge-label">${esc(badgeLabel || '')}</div>
            <div class="ed-badge-val">${esc(badgeVal)}</div>
          </div>` : ''}
      </div>
      ${body}
    </section>
  `;
}
// ═══ Gantt: implementation schedule of goals + active projects + plan milestones ═══

export function renderGantt({ rows, monthsWindow = 12 }) {
  if (!rows || rows.length === 0) {
    return `<div class="ed-card" style="text-align:center;color:var(--ink-2);font-size:var(--fs-xs)">no scheduled work · set goals or projects</div>`;
  }
  const today = new Date();
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endMonth = new Date(today.getFullYear(), today.getMonth() + monthsWindow, 0);
  const span = endMonth - startMonth;

  const monthLabels = [];
  for (let i = 0; i < monthsWindow; i++) {
    const d = new Date(startMonth);
    d.setMonth(d.getMonth() + i);
    monthLabels.push(d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase());
  }

  // Today line
  const nowOffset = ((today - startMonth) / span) * 100;

  const bars = rows.map((r, i) => {
    const start = clampDate(r.start, startMonth, endMonth);
    const end   = clampDate(r.end,   startMonth, endMonth);
    if (end < startMonth || start > endMonth) return { r, hide: true };
    const left  = Math.max(0, ((start - startMonth) / span) * 100);
    const width = Math.min(100 - left, ((end - start) / span) * 100);
    return { r, left, width, hide: false };
  });

  return `
    <div class="gantt-months">
      <div></div>
      <div class="gantt-month-labels">
        ${monthLabels.map(m => `<span>${m}</span>`).join('')}
      </div>
    </div>
    <div class="gantt">
      <div class="gantt-headcol">
        ${rows.map((r, i) => `
          <div class="gantt-row-label">
            <span>${esc(r.label)}</span>
            <span class="ed-row-code">${esc(r.code || ('R' + (i + 1)))}</span>
          </div>
        `).join('')}
      </div>
      <div class="gantt-bars" style="position: relative">
        ${bars.map(({ r, left, width, hide }, i) => hide
          ? `<div class="gantt-track"></div>`
          : `<div class="gantt-track">
              <div class="gantt-bar ${r.status === 'done' ? 'is-done' : ''} ${r.status === 'blocked' ? 'is-blocked' : ''} ${r.status === 'future' ? 'is-future' : ''}"
                   style="left:${left.toFixed(2)}%; width:${Math.max(2, width).toFixed(2)}%; animation-delay:${i * 60}ms">
                ${esc(r.barLabel || r.label.slice(0, 24))}
              </div>
            </div>`
        ).join('')}
        <div class="gantt-today-line" style="left: ${nowOffset.toFixed(2)}%"></div>
      </div>
    </div>
  `;
}

function clampDate(d, lo, hi) {
  const dt = new Date(d);
  if (dt < lo) return lo;
  if (dt > hi) return hi;
  return dt;
}

// ═══ Y-Matrix: rows × (Y1/Y2/Y3 or any 3 cols) + sources column + totals ═══

export function renderYMatrix({ headers, rows, totalRow, totalLabel = 'Total' }) {
  return `
    <div class="ymatrix">
      <div class="ymatrix-row is-header">
        <span>${esc(headers[0])}</span>
        <span class="ymatrix-num">${esc(headers[1])}</span>
        <span class="ymatrix-num">${esc(headers[2])}</span>
        <span class="ymatrix-num">${esc(headers[3])}</span>
        <span class="ymatrix-priority">${esc(headers[4] || '')}</span>
      </div>
      ${rows.map(r => `
        <div class="ymatrix-row">
          <span>${esc(r.label)}</span>
          <span class="ymatrix-num">${esc(r.v1)}</span>
          <span class="ymatrix-num">${esc(r.v2)}</span>
          <span class="ymatrix-num">${esc(r.v3)}</span>
          <span class="ymatrix-priority">${esc(r.source || '')}</span>
        </div>
      `).join('')}
      ${totalRow ? `
        <div class="ymatrix-row is-total">
          <span>${esc(totalLabel)}</span>
          <span class="ymatrix-num">${esc(totalRow.v1)}</span>
          <span class="ymatrix-num">${esc(totalRow.v2)}</span>
          <span class="ymatrix-num">${esc(totalRow.v3)}</span>
          <span class="ymatrix-priority">${esc(totalRow.note || '')}</span>
        </div>
      ` : ''}
    </div>
  `;
}

// ═══ Stacked bars: revenue-growth-style horizontal bars ═══

export function renderStackedBars({ rows, max }) {
  const m = max || Math.max(1, ...rows.map(r => Math.max(r.value, r.target || 0)));
  return `
    <div class="stacked-bars">
      ${rows.map((r, i) => {
        const pct = (r.value / m) * 100;
        const tgtPct = r.target ? (r.target / m) * 100 : 0;
        return `
          <div class="stacked-bar-row">
            <div class="stacked-bar-label">${esc(r.label)}</div>
            <div class="stacked-bar-track">
              ${r.target ? `<div class="stacked-bar-fill is-target" style="width:${Math.min(100, tgtPct).toFixed(2)}%; animation-delay:${i * 80}ms"></div>` : ''}
              <div class="stacked-bar-fill" style="margin-left: -${r.target ? Math.min(100, tgtPct).toFixed(2) : 0}%; width:${Math.min(100, pct).toFixed(2)}%; animation-delay:${(i * 80) + 200}ms"></div>
            </div>
            <div class="stacked-bar-num">${esc(r.formatted ?? r.value)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ═══ Cumulative cash position bars ═══

export function renderCumulativeCash({ rows, breakevenAt }) {
  const max = Math.max(1, ...rows.map(r => Math.abs(r.value)));
  return `
    <div class="cash-rows">
      ${rows.map((r, i) => {
        const pct = (Math.abs(r.value) / max) * 100;
        const isBE = r.label === breakevenAt;
        return `
          <div class="cash-row-ed ${isBE ? 'is-breakeven' : ''}">
            <div class="cash-row-label">${esc(r.label)}</div>
            <div class="cash-row-bar">
              <div class="cash-row-fill ${r.value < 0 ? 'is-neg' : ''}" style="width:${pct.toFixed(2)}%; animation-delay:${i * 70}ms"></div>
            </div>
            <div class="cash-row-value">
              ${esc(r.display || formatK(r.value))}
              ${isBE ? `<span class="ed-breakeven">break-even</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function formatK(n) {
  if (n === 0) return '0';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  if (abs >= 1000) return sign + (abs / 1000).toFixed(0) + 'k';
  return sign + abs.toFixed(0);
}

// ═══ Key indicator row (e.g. DSCR style) ═══

export function renderKeyIndicators({ headers, rows }) {
  return `
    <div class="key-indicator is-header">
      <span>${esc(headers[0])}</span>
      <span class="key-indicator-val" style="font-style:normal;font-family:var(--font-mono);font-size:9px;color:var(--ink-2)">${esc(headers[1])}</span>
      <span class="key-indicator-val" style="font-style:normal;font-family:var(--font-mono);font-size:9px;color:var(--ink-2)">${esc(headers[2])}</span>
      <span class="key-indicator-val" style="font-style:normal;font-family:var(--font-mono);font-size:9px;color:var(--ink-2)">${esc(headers[3])}</span>
    </div>
    ${rows.map(r => `
      <div class="key-indicator">
        <span class="key-indicator-label">${esc(r.label)}</span>
        <span class="key-indicator-val">${esc(r.v1)}</span>
        <span class="key-indicator-val">${esc(r.v2)}</span>
        <span class="key-indicator-val">${esc(r.v3)}</span>
      </div>
    `).join('')}
  `;
}
