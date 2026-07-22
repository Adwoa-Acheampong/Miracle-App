// Canonical hash-route paths. Import as `import { R } from './util/routes.js'`
// and use `navigate(R.dashboard)` instead of `navigate('/dashboard')`.
//
// Typos here become a runtime error instead of a silent 404. New routes need
// one line here AND one entry in the ROUTES table in main.js.

export const R = Object.freeze({
  dashboard: '/dashboard',
  login:     '/login',
  settings:  '/settings',
  bitmoji:   '/bitmoji',
  search:    '/search',
  book:      '/book',
  focus:     '/focus',
  prophecies:'/prophecies',
  trash:     '/trash',

  // Domains
  dreams:    '/dreams',
  ideas:     '/ideas',
  bible:     '/bible',
  prayer:    '/prayer',
  fasting:   '/fasting',
  plans:     '/plans',
  projects:  '/projects',
  tasks:     '/tasks',
  schedule:  '/schedule',
  finance:   '/finance',
  meals:     '/meals',
  music:     '/music',
  books:     '/books',
  people:    '/people',
  testimony: '/testimony',
  blog:      '/blog',
  quizzes:   '/quizzes',

  // Dynamic paths — call as functions
  day:    date => `/day/${date}`,
  blogId: id   => `/blog/${id}`,
});
