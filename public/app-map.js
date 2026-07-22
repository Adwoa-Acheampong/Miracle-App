import { R } from './util/routes.js';

export const APP_LANES = [
  {
    id: 'today',
    title: 'Today',
    desc: 'Start, schedule, focus, and close the day cleanly.',
    iconName: 'calendar',
    promise: 'show up clean',
    items: [
      { id: 'dashboard', label: 'Dashboard', desc: 'Start here and read the day.', store: null, iconName: 'layout-dashboard', route: R.dashboard, verb: 'start' },
      { id: 'daily', label: 'Daily page', desc: 'Journal, gratitude, mood.', store: 'daily', iconName: 'calendar', route: today => R.day(today), verb: 'write' },
      { id: 'focus', label: 'Focus', desc: 'Run a work session.', store: 'focusSessions', iconName: 'target', route: R.focus, verb: 'work' },
      { id: 'tasks', label: 'Tasks', desc: 'Close next actions.', store: 'tasks', iconName: 'list-checks', route: R.tasks, verb: 'close' },
      { id: 'schedule', label: 'Schedule', desc: 'Events and commitments.', store: 'events', iconName: 'calendar', route: R.schedule, verb: 'time' },
    ],
  },
  {
    id: 'faith',
    title: 'Faith',
    desc: 'Scripture, prayer, fasting, prophecy, and testimony.',
    iconName: 'flame',
    promise: 'stay anchored',
    items: [
      { id: 'bible', label: 'Bible', desc: 'Study and reading plan.', store: 'bible', iconName: 'scroll', route: R.bible, verb: 'read' },
      { id: 'prayer', label: 'Prayer', desc: 'Requests and answers.', store: 'prayers', iconName: 'flame', route: R.prayer, verb: 'stand' },
      { id: 'fasting', label: 'Fasting', desc: 'Track fasts and purpose.', store: 'fasts', iconName: 'moon', route: R.fasting, verb: 'fast' },
      { id: 'prophecies', label: 'Prophecies', desc: 'Discern received words.', store: 'prophecies', iconName: 'scroll-text', route: R.prophecies, verb: 'discern' },
      { id: 'testimony', label: 'Testimony', desc: 'Record what God did.', store: 'testimonies', iconName: 'megaphone', route: R.testimony, verb: 'record' },
    ],
  },
  {
    id: 'build',
    title: 'Build',
    desc: 'Ideas, plans, projects, publishing, and review.',
    iconName: 'target',
    promise: 'turn sparks into shipped work',
    items: [
      { id: 'ideas', label: 'Ideas', desc: 'Capture raw sparks.', store: 'ideas', iconName: 'lightbulb', route: R.ideas, verb: 'capture' },
      { id: 'plans', label: 'Plans', desc: 'Shape ventures and direction.', store: 'plans', iconName: 'target', route: R.plans, verb: 'shape' },
      { id: 'projects', label: 'Projects', desc: 'Ship active work.', store: 'projects', iconName: 'target', route: R.projects, verb: 'ship' },
      { id: 'blog', label: 'Blog', desc: 'Turn thoughts into posts.', store: 'blogs', iconName: 'feather', route: R.blog, verb: 'publish' },
      { id: 'quizzes', label: 'Quizzes', desc: 'Review what should stick.', store: 'quizzes', iconName: 'sparkles', route: R.quizzes, verb: 'review' },
    ],
  },
  {
    id: 'life',
    title: 'Life',
    desc: 'Money, food, people, learning, music, and dreams.',
    iconName: 'heart',
    promise: 'care for the practical things',
    items: [
      { id: 'finance', label: 'Finance', desc: 'Money, tithe, cash flow.', store: 'transactions', iconName: 'wallet', route: R.finance, verb: 'track' },
      { id: 'meals', label: 'Meals', desc: 'Food and energy.', store: 'meals', iconName: 'heart', route: R.meals, verb: 'fuel' },
      { id: 'people', label: 'People', desc: 'Relationships to care for.', store: 'people', iconName: 'users', route: R.people, verb: 'care' },
      { id: 'books', label: 'Books', desc: 'Reading and notes.', store: 'books', iconName: 'book-open', route: R.books, verb: 'learn' },
      { id: 'music', label: 'Music', desc: 'Songs and worship notes.', store: 'music', iconName: 'music', route: R.music, verb: 'listen' },
      { id: 'dreams', label: 'Dreams', desc: 'Notice patterns and symbols.', store: 'dreams', iconName: 'moon', route: R.dreams, verb: 'notice' },
    ],
  },
];

export function resolveRoute(item, today = new Date().toISOString().slice(0, 10)) {
  return typeof item.route === 'function' ? item.route(today) : item.route;
}

export function getAppMenuGroups(today = new Date().toISOString().slice(0, 10)) {
  return APP_LANES.map(lane => ({
    title: lane.title,
    desc: lane.desc,
    items: lane.items.map(item => ({
      ...item,
      route: resolveRoute(item, today),
    })),
  }));
}

export function getAllStoreNames() {
  return [...new Set(APP_LANES.flatMap(lane => lane.items.map(item => item.store).filter(Boolean)))];
}
