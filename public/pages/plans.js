import { all } from '../store.js';
import {
  bindDrawerRows,
  renderEmptyState,
  renderPageShell,
  reloadOnDrawerClose,
} from '../page-system.js';
import { esc } from '../util/esc.js';

export async function render() {
  const [plans, projects] = await Promise.all([all('plans'), all('projects')]);
  const active = plans.filter(plan => !['concept', 'sunset'].includes(plan.phase || 'concept')).length;
  const capitalNeed = plans.reduce((sum, plan) => sum + (Number(plan.capitalNeed) || 0), 0);
  const byVenture = groupBy(plans, plan => plan.venture || 'Other');

  const root = document.createElement('div');
  root.className = 'page';
  root.innerHTML = renderPageShell({
    title: 'Plans',
    kicker: 'Build lane',
    description: 'Turn venture ideas into phases, capital needs, milestones, and project execution.',
    iconName: 'compass',
    stats: [
      { label: 'plans', value: plans.length },
      { label: 'active', value: active },
      { label: 'capital', value: formatMoney(capitalNeed) },
    ],
    body: plans.length
      ? `
        <section class="build-summary">
          ${renderSummaryTile('Validation', plans.filter(plan => plan.phase === 'validation').length, 'ideas being tested')}
          ${renderSummaryTile('Build', plans.filter(plan => ['build', 'launch', 'scale'].includes(plan.phase)).length, 'plans in motion')}
          ${renderSummaryTile('Sunset', plans.filter(plan => plan.phase === 'sunset').length, 'closed or paused')}
        </section>
        <section class="sys-section">
          <div class="section-head">
            <span>Venture map</span>
            <small>${Object.keys(byVenture).length} ventures</small>
          </div>
          <div class="venture-grid">
            ${Object.entries(byVenture).map(([venture, items]) => renderVenture(venture, items, projects)).join('')}
          </div>
        </section>
      `
      : renderEmptyState({
          title: 'No plans yet',
          hint: 'Create the first plan with a venture, phase, thesis, and milestone path.',
          iconName: 'compass',
        }),
  });

  bindDrawerRows(root);
  reloadOnDrawerClose(root);
  return root;
}

function renderSummaryTile(label, value, hint) {
  return `
    <article class="build-summary-tile">
      <span>${esc(label)}</span>
      <strong>${esc(String(value))}</strong>
      <small>${esc(hint)}</small>
    </article>
  `;
}

function renderVenture(venture, plans, projects) {
  return `
    <article class="venture-block">
      <div class="venture-head">
        <strong>${esc(venture)}</strong>
        <small>${plans.length} plan${plans.length === 1 ? '' : 's'}</small>
      </div>
      <div class="plan-card-stack">
        ${plans.map(plan => renderPlanCard(plan, projects)).join('')}
      </div>
    </article>
  `;
}

function renderPlanCard(plan, projects) {
  const planProjects = projects.filter(project => project.parentPlan === plan.id);
  const milestones = Array.isArray(plan.milestones) ? plan.milestones : [];
  const doneMilestones = milestones.filter(item => item.doneOn).length;
  const title = plan.title || (plan.thesis || '').slice(0, 64) || 'untitled plan';

  return `
    <button class="plan-card" type="button" data-store="plans" data-id="${esc(plan.id)}">
      <span class="plan-phase">${esc(plan.phase || 'concept')}</span>
      <strong>${esc(title)}</strong>
      ${plan.thesis && plan.thesis !== title ? `<p>${esc(plan.thesis)}</p>` : ''}
      <span class="plan-metrics">
        <small>${doneMilestones}/${milestones.length || 0} milestones</small>
        <small>${planProjects.length} projects</small>
        ${plan.capitalNeed ? `<small>${formatMoney(Number(plan.capitalNeed))}</small>` : ''}
      </span>
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

function formatMoney(value) {
  if (!value) return '0';
  if (Math.abs(value) >= 1000000) return `${Math.round(value / 100000) / 10}m`;
  if (Math.abs(value) >= 1000) return `${Math.round(value / 100) / 10}k`;
  return String(Math.round(value));
}
