// Follow-Through Index — composite score (0-100), snapshot daily.

import { all, put } from './store.js';

const WEIGHTS = {
  taskClosure:        0.25,
  projectVelocity:    0.20,
  planMilestoneHealth:0.15,
  prayerCadence:      0.10,
  bibleCadence:       0.10,
  fastCompletion:     0.10,
  debriefDiscipline:  0.10,
};

export async function computeFTI(date = new Date().toISOString().slice(0, 10)) {
  const [tasks, projects, plans, prayers, bible, fasts, events] = await Promise.all([
    safeAll('tasks'), safeAll('projects'), safeAll('plans'),
    safeAll('prayers'), safeAll('bible'), safeAll('fasts'), safeAll('events'),
  ]);

  const components = {
    taskClosure:         taskClosureRate(tasks),
    projectVelocity:     projectVelocity(projects, tasks),
    planMilestoneHealth: planMilestoneHealth(plans),
    prayerCadence:       cadence(prayers, 'startedOn', 14),
    bibleCadence:        cadence(bible, 'updatedAt', 14),
    fastCompletion:      fastCompletion(fasts),
    debriefDiscipline:   debriefDiscipline(events),
  };

  // Fresh-user guard: if there's literally no activity yet, score is 0%, not 80%.
  // Avoids the misleading "you're crushing it!" hero number on first open.
  const totalActivity = tasks.length + projects.length + plans.length + prayers.length + bible.length + fasts.length + events.length;
  if (totalActivity === 0) {
    const zeroed = Object.fromEntries(Object.keys(WEIGHTS).map(k => [k, 0]));
    return { date, score: 0, components: zeroed, weights: WEIGHTS, fresh: true };
  }

  const score = Math.round(Object.entries(WEIGHTS).reduce((s, [k, w]) => s + (components[k] || 0) * w * 100, 0));
  return { date, score, components, weights: WEIGHTS };
}

export async function snapshotFTI() {
  const r = await computeFTI();
  await put('fti', { date: r.date, score: r.score, components: r.components });
  return r;
}

async function safeAll(store) { try { return await all(store); } catch { return []; } }

function taskClosureRate(tasks) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const today     = new Date().toISOString().slice(0, 10);
  const due = tasks.filter(t =>
    (t.priority === 'P0' || t.priority === 'P1')
    && t.scheduledFor
    && t.scheduledFor >= cutoffStr
    && t.scheduledFor <= today
  );
  // No due priority tasks is not a win; it is simply no signal.
  if (due.length === 0) return 0;
  const closed = due.filter(t => t.completedAt && t.completedAt.slice(0, 10) <= t.scheduledFor).length;
  return closed / due.length;
}

function projectVelocity(projects, tasks) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 28);
  const cutoffStr = cutoff.toISOString();
  const inFlight = projects.filter(p => p.phase !== 'ship' && p.phase !== 'maintain');
  if (inFlight.length === 0) return 0;
  let total = 0;
  for (const p of inFlight) {
    const projTasks = tasks.filter(t => t.linkedTo === p.id);
    const recent    = projTasks.filter(t => (t.updatedAt || '') >= cutoffStr);
    const closed    = recent.filter(t => t.completedAt).length;
    const added     = recent.length;
    total += added > 0 ? closed / added : 0;
  }
  return total / inFlight.length;
}

function planMilestoneHealth(plans) {
  const active = plans.filter(p => p.phase && !['concept','sunset'].includes(p.phase));
  if (active.length === 0) return 0;
  let totalSlip = 0, count = 0;
  for (const p of active) {
    for (const m of (p.milestones || [])) {
      if (m.due && !m.doneOn) {
        const slip = (Date.now() - new Date(m.due).getTime()) / 86400000;
        if (slip > 0) { totalSlip += slip; count++; }
      }
    }
  }
  if (count === 0) return 0;
  return Math.max(0, 1 - (totalSlip / count) / 30);
}

function cadence(items, dateField, days) {
  const dates = new Set(items.map(i => (i[dateField] || '').slice(0, 10)));
  let hits = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    if (dates.has(d.toISOString().slice(0, 10))) hits++;
  }
  return hits / days;
}

function fastCompletion(fasts) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
  const recent = fasts.filter(f => f.startedAt && new Date(f.startedAt) >= cutoff && f.endedAt);
  if (recent.length === 0) return 0;
  const completed = recent.filter(f => !f.plannedEndAt || new Date(f.endedAt) >= new Date(f.plannedEndAt)).length;
  return completed / recent.length;
}

function debriefDiscipline(events) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  const past = events.filter(e => e.endAt && new Date(e.endAt) >= cutoff && new Date(e.endAt) < new Date());
  if (past.length === 0) return 0;
  return past.filter(e => e.debriefNotes || e.debriefDoneAt).length / past.length;
}
