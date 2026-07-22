import { all, put } from '../store.js';
import { openDrawer } from '../drawer.js';
import { renderEmptyState, renderPageShell } from '../page-system.js';
import { icon } from '../icons.js';
import { esc } from '../util/esc.js';

export async function render() {
  const tasks = (await all('tasks')).sort(sortTasks);
  const today = new Date().toISOString().slice(0, 10);
  const open = tasks.filter(task => !task.completedAt);
  const done = tasks.filter(task => task.completedAt);
  const todayOpen = open.filter(task => task.scheduledFor === today).length;
  const p0 = open.filter(task => task.priority === 'P0').length;

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = renderPageShell({
    title: 'Tasks',
    kicker: 'Today lane',
    description: 'Close the next visible action without losing the deeper record.',
    iconName: 'list-checks',
    stats: [
      { label: 'open', value: open.length },
      { label: 'today', value: todayOpen },
      { label: 'P0', value: p0 },
    ],
    body: tasks.length
      ? `
        ${renderTaskSection('Open', open, today)}
        ${renderTaskSection('Done', done.slice(0, 12), today)}
      `
      : renderEmptyState({
          title: 'No tasks yet',
          hint: 'Create one clear next action and assign it to today.',
          iconName: 'list-checks',
        }),
  });

  root.querySelectorAll('.task-toggle').forEach(btn => {
    btn.addEventListener('click', async event => {
      event.stopPropagation();
      const task = tasks.find(item => item.id === btn.dataset.id);
      if (!task) return;
      const completing = !task.completedAt;
      const next = completing
        ? { ...task, completedAt: new Date().toISOString() }
        : { ...task, completedAt: null };
      await put('tasks', next);
      if (completing) {
        const { triggerCompletionFlash, updateStreak } = await import('../rewards.js');
        triggerCompletionFlash(btn);
        updateStreak('tasks');
      }
      root.replaceWith(await render());
    });
  });

  root.querySelectorAll('.task-row').forEach(row => {
    row.addEventListener('click', () => openDrawer('tasks', row.dataset.id));
  });

  window.addEventListener('drawer:close', once(async () => {
    if (root.isConnected) root.replaceWith(await render());
  }), { once: true });

  return root;
}

function renderTaskSection(label, tasks, today) {
  if (!tasks.length) return '';
  return `
    <section class="sys-section">
      <div class="section-head">
        <span>${label}</span>
        <small>${tasks.length}</small>
      </div>
      <div class="task-stack">
        ${tasks.map(task => renderTask(task, today)).join('')}
      </div>
    </section>
  `;
}

function renderTask(task, today) {
  const done = !!task.completedAt;
  const meta = [
    task.priority || 'P2',
    task.context || '',
    whenLabel(task.scheduledFor, today),
    done ? 'done' : '',
  ].filter(Boolean).join(' · ');

  return `
    <article class="task-row ${done ? 'is-done' : ''}" data-id="${esc(task.id)}">
      <button class="task-toggle" type="button" data-id="${esc(task.id)}" aria-label="${done ? 'reopen task' : 'complete task'}">
        ${icon(done ? 'check' : 'circle', { size: 16 })}
      </button>
      <div class="task-copy">
        <strong>${esc(task.title || 'untitled task')}</strong>
        <small>${esc(meta)}</small>
      </div>
      <span class="task-priority">${esc(task.priority || 'P2')}</span>
    </article>
  `;
}

function sortTasks(a, b) {
  if (!!a.completedAt !== !!b.completedAt) return a.completedAt ? 1 : -1;
  const priority = priorityRank(a.priority) - priorityRank(b.priority);
  if (priority) return priority;
  return (a.scheduledFor || '').localeCompare(b.scheduledFor || '') ||
    (b.updatedAt || '').localeCompare(a.updatedAt || '');
}

function priorityRank(priority = 'P2') {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority] ?? 2;
}

function whenLabel(date, today) {
  if (!date) return '';
  if (date === today) return 'today';
  return date;
}

function once(fn) {
  let done = false;
  return (...args) => {
    if (done) return;
    done = true;
    fn(...args);
  };
}
