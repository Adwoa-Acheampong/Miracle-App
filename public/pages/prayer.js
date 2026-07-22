import { all } from '../store.js';
import { openDrawer } from '../drawer.js';
import { renderEmptyState, renderPageShell, reloadOnDrawerClose } from '../page-system.js';
import { esc } from '../util/esc.js';

export async function render() {
  const prayers = (await all('prayers')).sort((a, b) => (b.startedOn || '').localeCompare(a.startedOn || ''));
  const pending = prayers.filter(prayer => !prayer.answer || prayer.answer === 'pending');
  const answered = prayers.filter(prayer => prayer.answer && prayer.answer !== 'pending');
  const cadence = streak(prayers, 14);

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = renderPageShell({
    title: 'Prayer',
    kicker: 'Faith lane',
    description: 'Carry requests, scripture, answers, and prayer cadence in one place.',
    iconName: 'flame',
    stats: [
      { label: 'pending', value: pending.length },
      { label: 'answered', value: answered.length },
      { label: '14d cadence', value: cadence },
    ],
    body: prayers.length
      ? `
        ${renderPrayerGauge({ pending: pending.length, answered: answered.length, cadence })}
        ${renderPrayerSection('Standing', pending)}
        ${renderPrayerSection('Answered', answered)}
      `
      : renderEmptyState({
          title: 'No prayer requests yet',
          hint: 'Add a subject, scripture, and cadence when you are ready.',
          iconName: 'flame',
        }),
  });

  root.querySelectorAll('.prayer-card').forEach(card => {
    card.addEventListener('click', () => openDrawer('prayers', card.dataset.id));
  });
  reloadOnDrawerClose(root);
  return root;
}

function renderPrayerGauge({ pending, answered, cadence }) {
  const total = Math.max(1, pending + answered);
  const answeredPct = Math.round((answered / total) * 100);
  const cadencePct = Math.round((cadence / 14) * 100);
  return `
    <section class="faith-gauge">
      <div class="faith-gauge-item" style="--meter:${answeredPct}%">
        <span>answered</span>
        <strong>${answeredPct}%</strong>
        <i><b></b></i>
      </div>
      <div class="faith-gauge-item" style="--meter:${cadencePct}%">
        <span>cadence</span>
        <strong>${cadence}/14</strong>
        <i><b></b></i>
      </div>
    </section>
  `;
}

function renderPrayerSection(label, prayers) {
  if (!prayers.length) return '';
  return `
    <section class="sys-section">
      <div class="section-head">
        <span>${label}</span>
        <small>${prayers.length}</small>
      </div>
      <div class="prayer-wall sys-prayer-wall">
        ${prayers.map(prayerCard).join('')}
      </div>
    </section>
  `;
}

function prayerCard(prayer) {
  const intensity = Math.max(1, Math.min(5, Number(prayer.intensity) || 1));
  const answered = prayer.answer && prayer.answer !== 'pending';
  const meta = [
    prayer.type || 'supplication',
    prayer.startedOn || '',
    answered ? prayer.answer : '',
  ].filter(Boolean).join(' - ');

  return `
    <article class="prayer-card ${answered ? 'is-answered' : ''}" data-id="${esc(prayer.id)}">
      <div class="prayer-intensity">intensity ${intensity}/5</div>
      <div class="prayer-subject">${esc(prayer.subject || 'untitled prayer')}</div>
      <div class="prayer-meta">${esc(meta)}</div>
    </article>
  `;
}

function streak(prayers, days) {
  const dates = new Set(prayers.map(prayer => (prayer.startedOn || (prayer.updatedAt || '').slice(0, 10))));
  let count = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (dates.has(d.toISOString().slice(0, 10))) count++;
  }
  return count;
}
