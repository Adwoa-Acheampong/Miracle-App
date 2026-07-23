const today = () => new Date().toISOString().slice(0, 10);
const nowLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const text = (key, label, options = {}) => ({ key, label, type: 'text', ...options });
const area = (key, label, options = {}) => ({ key, label, type: 'textarea', ...options });
const select = (key, label, options, value) => ({ key, label, type: 'select', options, value });
const date = (key, label, value = today) => ({ key, label, type: 'date', value });
const datetime = (key, label, value = nowLocal) => ({ key, label, type: 'datetime-local', value });
const number = (key, label, options = {}) => ({ key, label, type: 'number', ...options });

export const ROOMS = Object.freeze({
  morning: {
    id: 'morning',
    name: 'Morning Gate',
    subtitle: 'Wake and choose the day',
    icon: 'sunrise',
    scene: 'gate',
    featureIds: ['rhythm', 'daily', 'schedule'],
  },
  chapel: {
    id: 'chapel',
    name: 'Chapel',
    subtitle: 'Stand spiritually',
    icon: 'flame',
    scene: 'chapel',
    featureIds: ['prayer', 'bible', 'fasting', 'prophecy', 'testimony', 'music'],
  },
  workshop: {
    id: 'workshop',
    name: 'Workshop',
    subtitle: 'Turn intention into finished work',
    icon: 'hammer',
    scene: 'workshop',
    featureIds: ['focus', 'tasks', 'ideas', 'plans', 'projects', 'blog', 'quizzes'],
  },
  garden: {
    id: 'garden',
    name: 'Garden',
    subtitle: 'Care for practical life',
    icon: 'flower-2',
    scene: 'garden',
    featureIds: ['meals', 'finance', 'people', 'books'],
  },
  archive: {
    id: 'archive',
    name: 'Archive',
    subtitle: 'Remember and interpret',
    icon: 'book-open',
    scene: 'archive',
    featureIds: ['book', 'dreams', 'search', 'trash'],
  },
});

export const FEATURES = Object.freeze({
  rhythm: {
    id: 'rhythm', room: 'morning', name: "Today's path", verb: 'See what remains', icon: 'sunrise', special: 'rhythm',
    description: 'Complete or intentionally close the practices you chose for today.',
  },
  daily: {
    id: 'daily', room: 'morning', name: 'Daily page', verb: 'Write today', icon: 'pen-line', store: 'daily',
    titleKey: 'oneSentence', description: 'Leave one clear memory of the day.',
    fields: [
      text('oneSentence', 'The day in one sentence', { required: true, maxlength: 160 }),
      text('gratitudeOne', 'One gratitude', { maxlength: 120 }),
      area('freeform', 'What needs a page?', { maxlength: 1800 }),
    ],
    defaults: () => ({ date: today(), gratitude: ['', '', ''], attachments: [] }),
  },
  schedule: {
    id: 'schedule', room: 'morning', name: 'Schedule', verb: 'Place an event', icon: 'calendar-days', store: 'events',
    titleKey: 'title', description: 'Put a real commitment on the path.',
    fields: [
      text('title', 'Event', { required: true, maxlength: 120 }),
      datetime('startAt', 'Starts'),
      select('type', 'Kind', ['meeting', 'appointment', 'church', 'work', 'personal'], 'personal'),
      text('location', 'Place', { maxlength: 120 }),
      area('prepNotes', 'Preparation', { maxlength: 800 }),
    ],
  },
  prayer: {
    id: 'prayer', room: 'chapel', name: 'Prayer', verb: 'Place a prayer', icon: 'flame', store: 'prayers',
    titleKey: 'subject', description: 'Name what you are carrying before God.',
    fields: [
      text('subject', 'Prayer', { required: true, maxlength: 240 }),
      select('type', 'Posture', ['supplication', 'intercession', 'thanksgiving', 'worship'], 'supplication'),
      text('scripture', 'Scripture', { maxlength: 120 }),
      select('cadence', 'Return to it', ['one-off', 'daily', 'weekly', 'seasonal'], 'one-off'),
      number('intensity', 'Weight', { min: 1, max: 5, value: 3 }),
    ],
    defaults: () => ({ startedOn: today(), answer: 'pending' }),
  },
  bible: {
    id: 'bible', room: 'chapel', name: 'Scripture', verb: 'Open scripture', icon: 'book-open-text', store: 'bible', special: 'bible',
    titleKey: 'passage', description: 'Read, notice, and carry one truth forward.',
    fields: [
      text('passage', 'Passage', { required: true, placeholder: 'Romans 8:28', maxlength: 100 }),
      select('translation', 'Translation', ['NIV', 'KJV', 'NKJV', 'ESV', 'NLT', 'AMP', 'MSG'], 'NIV'),
      area('observation', 'What does it say?', { maxlength: 1200 }),
      area('application', 'What will you do?', { maxlength: 1000 }),
      area('prayer', 'Prayer from the passage', { maxlength: 800 }),
    ],
  },
  fasting: {
    id: 'fasting', room: 'chapel', name: 'Fasting', verb: 'Begin a fast', icon: 'moon-star', store: 'fasts',
    titleKey: 'purpose', description: 'Set the purpose and boundary before beginning.',
    fields: [
      text('purpose', 'Purpose', { required: true, maxlength: 180 }),
      select('type', 'Fast', ['water', 'partial', 'daniel', 'media', 'custom'], 'partial'),
      text('scripture', 'Anchor scripture', { maxlength: 120 }),
      datetime('startedAt', 'Begins'),
      datetime('plannedEndAt', 'Planned end'),
      area('reflection', 'Intention', { maxlength: 800 }),
    ],
  },
  prophecy: {
    id: 'prophecy', room: 'chapel', name: 'Prophecy', verb: 'Record a word', icon: 'scroll-text', store: 'prophecies',
    titleKey: 'word', description: 'Preserve the word, source, scripture, and state.',
    fields: [
      area('word', 'Word received', { required: true, maxlength: 1800 }),
      text('speaker', 'Speaker or source', { maxlength: 120 }),
      text('scripture', 'Supporting scripture', { maxlength: 140 }),
      date('dateReceived', 'Received'),
      select('status', 'State', ['testing', 'standing', 'fulfilled', 'archived'], 'testing'),
    ],
  },
  testimony: {
    id: 'testimony', room: 'chapel', name: 'Testimony', verb: 'Mark what happened', icon: 'sparkles', store: 'testimonies',
    titleKey: 'title', description: 'Turn answered moments into durable memory.',
    fields: [
      text('title', 'Title', { required: true, maxlength: 120 }),
      area('body', 'What did God do?', { required: true, maxlength: 1800 }),
      date('date', 'Date'),
      text('scripture', 'Scripture', { maxlength: 120 }),
    ],
    defaults: () => ({ status: 'active' }),
  },
  music: {
    id: 'music', room: 'chapel', name: 'Music', verb: 'Keep a song', icon: 'music-2', store: 'music',
    titleKey: 'title', description: 'Remember the song and the line that met you.',
    fields: [
      text('title', 'Song', { required: true, maxlength: 140 }),
      text('artist', 'Artist', { maxlength: 120 }),
      area('lyric', 'Line that stayed', { maxlength: 500 }),
      text('heard', 'Where you heard it', { maxlength: 160 }),
      date('date', 'Date'),
    ],
  },
  focus: {
    id: 'focus', room: 'workshop', name: 'Focus', verb: 'Start a session', icon: 'timer', store: 'focusSessions',
    titleKey: 'taskLabel', special: 'focus', description: 'Give one piece of work your undivided attention.',
  },
  tasks: {
    id: 'tasks', room: 'workshop', name: 'Tasks', verb: 'Set a next move', icon: 'list-checks', store: 'tasks',
    titleKey: 'title', description: 'Make the next visible action small and finishable.',
    fields: [
      text('title', 'Next action', { required: true, maxlength: 140 }),
      select('priority', 'Priority', ['P0', 'P1', 'P2', 'P3'], 'P2'),
      date('scheduledFor', 'For'),
      number('estMinutes', 'Minutes', { min: 1, max: 480, value: 25 }),
      text('context', 'Context', { maxlength: 80 }),
    ],
  },
  ideas: {
    id: 'ideas', room: 'workshop', name: 'Ideas', verb: 'Catch an idea', icon: 'lightbulb', store: 'ideas',
    titleKey: 'title', description: 'Catch it before it disappears.',
    fields: [
      text('title', 'Idea', { required: true, maxlength: 140 }),
      area('body', 'Shape it', { maxlength: 1200 }),
      select('status', 'State', ['active', 'dormant', 'promoted', 'archived'], 'active'),
    ],
  },
  plans: {
    id: 'plans', room: 'workshop', name: 'Plans', verb: 'Lay a plan', icon: 'route', store: 'plans',
    titleKey: 'title', description: 'Turn direction into a deliberate path.',
    fields: [
      text('title', 'Plan', { required: true, maxlength: 140 }),
      area('thesis', 'What must become true?', { maxlength: 1400 }),
      select('phase', 'Phase', ['seed', 'validate', 'build', 'launch', 'operate'], 'seed'),
      text('venture', 'Life area', { maxlength: 100 }),
    ],
  },
  projects: {
    id: 'projects', room: 'workshop', name: 'Projects', verb: 'Open a build site', icon: 'blocks', store: 'projects',
    titleKey: 'title', description: 'Give substantial work a visible place to grow.',
    fields: [
      text('title', 'Project', { required: true, maxlength: 140 }),
      select('phase', 'Phase', ['idea', 'planning', 'active', 'paused', 'complete'], 'planning'),
      date('startedOn', 'Starts'),
      date('due', 'Due', null),
      area('body', 'Definition of done', { maxlength: 1200 }),
    ],
  },
  blog: {
    id: 'blog', room: 'workshop', name: 'Writing', verb: 'Start a draft', icon: 'feather', store: 'blogs',
    titleKey: 'title', description: 'Develop a thought until it can travel.',
    fields: [
      text('title', 'Title', { required: true, maxlength: 160 }),
      text('hook', 'Opening line', { maxlength: 280 }),
      area('seedText', 'Raw thought', { maxlength: 2200 }),
      select('status', 'State', ['seed', 'draft', 'ready', 'published', 'archived'], 'seed'),
    ],
  },
  quizzes: {
    id: 'quizzes', room: 'workshop', name: 'Recall', verb: 'Make a recall tile', icon: 'brain', store: 'quizzes',
    titleKey: 'question', description: 'Turn something worth remembering into retrieval practice.',
    fields: [
      area('question', 'Question', { required: true, maxlength: 600 }),
      area('answer', 'Answer', { required: true, maxlength: 1000 }),
      text('sourceLabel', 'Source', { maxlength: 120 }),
    ],
    defaults: () => ({ type: 'free', level: 0, status: 'due', nextDueAt: new Date().toISOString() }),
  },
  meals: {
    id: 'meals', room: 'garden', name: 'Meals', verb: 'Set the table', icon: 'utensils', store: 'meals',
    titleKey: 'actualItems', description: 'Notice what nourished you without moral scoring.',
    fields: [
      date('date', 'Date'),
      select('slot', 'Meal', ['breakfast', 'midmorning', 'lunch', 'teatime', 'dinner', 'latenight'], 'breakfast'),
      text('actualItems', 'What you ate', { required: true, maxlength: 240 }),
      select('feltAfter', 'Afterward', ['energized', 'neutral', 'sluggish', 'sick'], 'neutral'),
      number('costGhs', 'Cost (GHS)', { min: 0, step: 0.01 }),
    ],
  },
  finance: {
    id: 'finance', room: 'garden', name: 'Stewardship', verb: 'Record a movement', icon: 'wallet-cards', store: 'transactions',
    titleKey: 'memo', description: 'See where provision came from and where it went.',
    fields: [
      date('date', 'Date'),
      select('direction', 'Direction', ['out', 'in'], 'out'),
      number('amountGhs', 'Amount (GHS)', { required: true, min: 0.01, step: 0.01 }),
      text('payee', 'With whom', { maxlength: 120 }),
      text('category', 'Category', { maxlength: 80 }),
      area('memo', 'Note', { maxlength: 500 }),
    ],
  },
  people: {
    id: 'people', room: 'garden', name: 'People', verb: 'Tend a relationship', icon: 'users', store: 'people',
    titleKey: 'name', description: 'Remember the person, not just the task.',
    fields: [
      text('name', 'Name', { required: true, maxlength: 120 }),
      text('role', 'How you know them', { maxlength: 120 }),
      area('note', 'What matters now?', { maxlength: 1000 }),
      date('lastTouchedAt', 'Last connected'),
      select('pray', 'Praying for them', ['no', 'yes'], 'no'),
    ],
  },
  books: {
    id: 'books', room: 'garden', name: 'Reading', verb: 'Place a book', icon: 'library', store: 'books',
    titleKey: 'title', description: 'Keep what you read in motion.',
    fields: [
      text('title', 'Book', { required: true, maxlength: 160 }),
      text('author', 'Author', { maxlength: 120 }),
      select('status', 'Shelf', ['want', 'reading', 'finished', 'paused'], 'reading'),
      text('currentLocation', 'Current place', { maxlength: 80 }),
      area('keyIdeas', 'One idea to keep', { maxlength: 1000 }),
    ],
  },
  book: {
    id: 'book', room: 'archive', name: 'Living book', verb: 'Open the book', icon: 'book-open', special: 'book',
    description: 'Read the two leaves your life has written.',
  },
  dreams: {
    id: 'dreams', room: 'archive', name: 'Dreams', verb: 'Preserve a dream', icon: 'cloud-moon', store: 'dreams',
    titleKey: 'title', description: 'Record the dream before interpretation changes it.',
    fields: [
      text('title', 'Title', { required: true, maxlength: 140 }),
      select('type', 'Kind', ['nightDream', 'vision', 'prophetic', 'aspirational'], 'nightDream'),
      date('dreamDate', 'Date'),
      area('body', 'What happened?', { required: true, maxlength: 2200 }),
      text('symbols', 'Symbols', { maxlength: 240 }),
      text('scripture', 'Scripture', { maxlength: 120 }),
    ],
  },
  search: {
    id: 'search', room: 'archive', name: 'Search', verb: 'Find a memory', icon: 'search', special: 'search',
      description: 'Search the whole sanctuary by the words you remember.',
  },
  trash: {
    id: 'trash', room: 'archive', name: 'Trash', verb: 'Open trash', icon: 'trash-2', special: 'trash',
    description: 'Restore anything within 30 days or remove it permanently.',
  },
});

export function roomFor(id) {
  return ROOMS[id] || null;
}

export function featureFor(id) {
  return FEATURES[id] || null;
}

export function featuresForRoom(roomId) {
  return (ROOMS[roomId]?.featureIds || []).map(id => FEATURES[id]).filter(Boolean);
}

export function allDirectoryItems() {
  return Object.values(ROOMS).map(room => ({ ...room, features: featuresForRoom(room.id) }));
}

export function resolveDefault(field) {
  return typeof field.value === 'function' ? field.value() : field.value ?? '';
}
