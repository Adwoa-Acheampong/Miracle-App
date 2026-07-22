import { all, get, put } from '../store.js';
import { addDays, startOfWeek, ymd } from '../domain.js';
import { openDrawer } from '../drawer.js';
import { renderPageShell, reloadOnDrawerClose } from '../page-system.js';
import { esc } from '../util/esc.js';

let weekOffset = 0;

export async function render() {
  const events = await all('events');
  const weekStart = addDays(startOfWeek(), weekOffset * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = ymd(new Date());

  const byDay = days.map(date => {
    const dateStr = ymd(date);
    return {
      date,
      dateStr,
      isToday: dateStr === today,
      events: events
        .filter(event => event.startAt && ymd(event.startAt) === dateStr)
        .sort((a, b) => (a.startAt || '').localeCompare(b.startAt || '')),
    };
  });
  const thisWeekCount = byDay.reduce((sum, day) => sum + day.events.length, 0);
  const todayCount = byDay.find(day => day.isToday)?.events.length || 0;

  const root = document.createElement('div');
  root.className = 'page page-wide';
  root.innerHTML = renderPageShell({
    title: 'Schedule',
    kicker: 'Today lane',
    description: 'Plan commitments by week, mark completions, and keep the day visible.',
    iconName: 'calendar',
    stats: [
      { label: 'events', value: events.length },
      { label: 'this week', value: thisWeekCount },
      { label: 'today', value: todayCount },
    ],
    body: `
      <section class="schedule-controls">
        <strong>Week of ${esc(shortLabel(weekStart))}</strong>
        <button class="btn" id="wk-prev" type="button">Prev</button>
        <button class="btn" id="wk-curr" type="button">This week</button>
        <button class="btn" id="wk-next" type="button">Next</button>
      </section>
      <section class="week-strip">
        ${byDay.map(renderDay).join('')}
      </section>
    `,
  });

  root.querySelector('#wk-prev').addEventListener('click', async () => {
    weekOffset--;
    root.replaceWith(await render());
  });
  root.querySelector('#wk-curr').addEventListener('click', async () => {
    weekOffset = 0;
    root.replaceWith(await render());
  });
  root.querySelector('#wk-next').addEventListener('click', async () => {
    weekOffset++;
    root.replaceWith(await render());
  });

  root.querySelectorAll('.event-card').forEach(card => {
    card.addEventListener('click', event => {
      if (event.target.classList.contains('event-check')) return;
      openDrawer('events', card.dataset.id);
    });
  });
  root.querySelectorAll('.event-check').forEach(checkbox => {
    checkbox.addEventListener('click', async event => {
      event.stopPropagation();
      const current = await get('events', checkbox.dataset.id);
      if (!current) return;
      const next = { ...current, completedAt: checkbox.checked ? new Date().toISOString() : null };
      await put('events', next);
      if (checkbox.checked) {
        const { triggerCompletionFlash, updateStreak } = await import('../rewards.js');
        triggerCompletionFlash(checkbox);
        updateStreak('schedule');
      }
      root.replaceWith(await render());
    });
  });

  reloadOnDrawerClose(root);
  return root;
}

function renderDay(day) {
  return `
    <article class="week-day ${day.isToday ? 'is-today' : ''}">
      <div class="week-day-head">
        <span>${esc(day.date.toLocaleDateString(undefined, { weekday: 'short' }).toLowerCase())}</span>
        <strong>${day.date.getDate()}</strong>
      </div>
      <div class="week-day-events">
        ${day.events.length
          ? day.events.map(renderEvent).join('')
          : `<div class="week-empty">Open</div>`}
      </div>
    </article>
  `;
}

function renderEvent(event) {
  return `
    <article class="event-card ${event.completedAt ? 'is-done' : ''}" data-id="${esc(event.id)}">
      <input type="checkbox" class="event-check" data-id="${esc(event.id)}" ${event.completedAt ? 'checked' : ''} title="mark complete" />
      <div class="event-body">
        <div class="event-time">${esc(formatTime(event.startAt))}${event.endAt ? `-${esc(formatTime(event.endAt))}` : ''}</div>
        <div class="event-title">${esc(event.title || 'untitled event')}</div>
        ${event.location ? `<div class="event-loc">${esc(event.location)}</div>` : ''}
      </div>
    </article>
  `;
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

function shortLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase();
}
