import { all } from '../store.js';
import { PROJECT_PHASES } from '../domain.js';
import {
  bindDrawerRows,
  renderEmptyState,
  renderPageShell,
  reloadOnDrawerClose,
} from '../page-system.js';
import { esc } from '../util/esc.js';

export async function render() {
  const [projects, plans, tasks] = await Promise.all([
    all('projects'),
    all('plans'),
    all('tasks'),
  ]);
  const plansById = Object.fromEntries(plans.map(plan => [plan.id, plan]));
  const tasksByProject = groupBy(tasks.filter(task => task.linkedTo), task => task.linkedTo);
  const inFlight = projects.filter(project => !['ship', 'maintain'].includes(project.phase || 'brief')).length;
  const openTasks = tasks.filter(task => !task.completedAt && task.linkedTo && projects.some(project => project.id === task.linkedTo)).length;

  const root = document.createElement('div');
  root.className = 'page page-wide';
  root.innerHTML = renderPageShell({
    title: 'Projects',
    kicker: 'Build lane',
    description: 'Move work from brief to shipped, with open task pressure visible by project.',
    iconName: 'grid-3x3',
    stats: [
      { label: 'projects', value: projects.length },
      { label: 'in flight', value: inFlight },
      { label: 'open tasks', value: openTasks },
    ],
    body: projects.length
      ? `
        <section class="project-board">
          ${PROJECT_PHASES.map(phase => renderProjectLane({
            phase,
            projects: projects.filter(project => (project.phase || 'brief') === phase),
            plansById,
            tasksByProject,
          })).join('')}
        </section>
      `
      : renderEmptyState({
          title: 'No projects yet',
          hint: 'Create a project when a plan needs an execution container.',
          iconName: 'grid-3x3',
        }),
  });

  bindDrawerRows(root);
  reloadOnDrawerClose(root);
  return root;
}

function renderProjectLane({ phase, projects, plansById, tasksByProject }) {
  return `
    <section class="project-lane">
      <div class="project-lane-head">
        <span>${esc(phase)}</span>
        <small>${projects.length}</small>
      </div>
      <div class="project-lane-body">
        ${projects.length
          ? projects.map(project => renderProjectCard(project, plansById, tasksByProject)).join('')
          : `<div class="project-empty">Nothing here</div>`}
      </div>
    </section>
  `;
}

function renderProjectCard(project, plansById, tasksByProject) {
  const plan = plansById[project.parentPlan];
  const tasks = tasksByProject[project.id] || [];
  const open = tasks.filter(task => !task.completedAt).length;
  const complete = tasks.length ? Math.round(((tasks.length - open) / tasks.length) * 100) : 0;

  return `
    <button class="project-card" type="button" data-store="projects" data-id="${esc(project.id)}">
      <strong>${esc(project.title || 'untitled project')}</strong>
      <span>${esc(plan?.venture || plan?.title || 'independent')}</span>
      <i><b style="width:${complete}%"></b></i>
      <small>${open}/${tasks.length || 0} open tasks</small>
    </button>
  `;
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});
}
