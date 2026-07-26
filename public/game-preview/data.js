import { STORE_NAMES, openStore, ulid, put, get, all, del, restore, hardDelete } from '../store.js?v=__BUILD__';
import { FEATURES, ROOMS, featureFor } from './features.js?v=__BUILD__';

const ROOM_STORES = Object.freeze({
  morning: ['daily', 'events'],
  chapel: ['prayers', 'bible', 'fasts', 'prophecies', 'testimonies', 'music'],
  workshop: ['focusSessions', 'tasks', 'ideas', 'plans', 'projects', 'blogs', 'quizzes'],
  garden: ['meals', 'transactions', 'people', 'books'],
  archive: ['daily', 'dreams'],
});

const STORE_ROOM = Object.freeze(Object.fromEntries(
  Object.entries(ROOM_STORES).flatMap(([room, stores]) => stores.map(store => [store, room])),
));

export async function initializeGameData() {
  await openStore();
  return projectHouseState();
}

export async function getPreference(key, fallback = null) {
  const row = await get('meta', `game:${key}`);
  return row?.value ?? fallback;
}

export async function setPreference(key, value) {
  return put('meta', { key: `game:${key}`, value });
}

export const DAILY_PRACTICES = Object.freeze([
  { id: 'devotion', label: 'Prayer or scripture', room: 'chapel', icon: 'flame', suggested: true },
  { id: 'priority', label: 'One priority', room: 'workshop', icon: 'target', suggested: true },
  { id: 'mood', label: 'Inner weather', room: 'morning', icon: 'heart', suggested: true },
  { id: 'dream', label: 'Dream', room: 'archive', icon: 'cloud-moon' },
  { id: 'schedule', label: 'Schedule', room: 'morning', icon: 'calendar-days' },
  { id: 'meal', label: 'Meals', room: 'garden', icon: 'utensils' },
  { id: 'song', label: 'Song', room: 'chapel', icon: 'music-2' },
  { id: 'word', label: 'Word of knowledge', room: 'chapel', icon: 'scroll-text' },
]);

export async function getDailyRule(date = todayKey()) {
  const [stored, history] = await Promise.all([
    getPreference('dailyRule', null),
    getPreference('dailyRuleHistory', []),
  ]);
  const historical = [...history].filter(item => item.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  if (historical?.rule?.practices?.length) return { ...(stored || {}), ...historical.rule };
  if (stored?.practices?.length) return stored;
  return {
    practices: DAILY_PRACTICES.filter(item => item.suggested).map(item => item.id),
    morningReminder: '07:30',
    followThroughReminder: '19:00',
    quietFrom: '21:30',
    quietUntil: '07:00',
    remindersEnabled: false,
  };
}

export async function saveDailyRule(rule) {
  const allowed = new Set(DAILY_PRACTICES.map(item => item.id));
  const practices = [...new Set((rule.practices || []).filter(id => allowed.has(id)))];
  if (!practices.length) throw new Error('Choose at least one daily practice.');
  const savedRule = { ...rule, practices };
  const history = await getPreference('dailyRuleHistory', []);
  const effectiveFrom = todayKey();
  const nextHistory = history.filter(item => item.effectiveFrom !== effectiveFrom);
  nextHistory.push({ effectiveFrom, rule: savedRule });
  await Promise.all([
    setPreference('dailyRule', savedRule),
    setPreference('dailyRuleHistory', nextHistory.sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))),
  ]);
  return savedRule;
}

export async function loadDailyRhythm(date = todayKey()) {
  const [rule, morning, closures, prayers, bible, dreams, events, meals, music, prophecies, tasks] = await Promise.all([
    getDailyRule(date),
    loadMorningState(date),
    getPreference(`dailyClosures:${date}`, {}),
    all('prayers'), all('bible'), all('dreams'), all('events'), all('meals'), all('music'), all('prophecies'), all('tasks'),
  ]);
  const onDate = row => recordMatchesDate(row, date);
  const completed = {
    devotion: morning.completed.anchor || bible.some(onDate),
    priority: morning.completed.aim,
    mood: morning.completed.attend,
    dream: dreams.some(onDate),
    schedule: events.some(onDate),
    meal: meals.some(onDate),
    song: music.some(onDate),
    word: prophecies.some(onDate),
  };
  const practices = rule.practices.map(id => ({
    ...DAILY_PRACTICES.find(item => item.id === id),
    state: completed[id] ? 'complete' : closures[id]?.state || 'open',
    reason: closures[id]?.reason || '',
  }));
  const resolved = practices.filter(item => ['complete', 'closed', 'paused'].includes(item.state)).length;
  const openLoops = tasks.filter(row => String(row.scheduledFor || '').slice(0, 10) === date && !row.completedAt);
  return { date, rule, practices, openLoops, resolved, total: practices.length, complete: practices.length > 0 && resolved === practices.length && openLoops.length === 0 };
}

export async function loadYearOfLight(year = new Date().getFullYear()) {
  const [rule, history, meta, daily, prayers, bible, tasks, dreams, events, meals, music, prophecies] = await Promise.all([
    getDailyRule(), getPreference('dailyRuleHistory', []), all('meta'), all('daily'), all('prayers'), all('bible'), all('tasks'), all('dreams'), all('events'), all('meals'), all('music'), all('prophecies'),
  ]);
  const closureMap = new Map(meta
    .filter(row => String(row.key || '').startsWith('game:dailyClosures:'))
    .map(row => [String(row.key).slice('game:dailyClosures:'.length), row.value || {}]));
  const ruleFor = date => {
    const item = [...history].filter(entry => entry.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
    return item?.rule || rule;
  };
  const today = todayKey();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const days = [];
  for (let cursor = start; cursor < end; cursor = new Date(cursor.getTime() + 86400000)) {
    const date = cursor.toISOString().slice(0, 10);
    if (date > today) {
      days.push({ date, state: 'future', resolved: 0, total: 0, percent: 0 });
      continue;
    }
    const onDate = row => recordMatchesDate(row, date);
    const completed = {
      devotion: prayers.some(onDate) || bible.some(onDate),
      priority: tasks.some(row => row.morningAim === true && onDate(row)),
      mood: daily.some(row => row.date === date && row.mood && Number.isFinite(Number(row.moodScore))),
      dream: dreams.some(onDate), schedule: events.some(onDate), meal: meals.some(onDate), song: music.some(onDate), word: prophecies.some(onDate),
    };
    const active = ruleFor(date).practices || [];
    const closures = closureMap.get(date) || {};
    const resolved = active.filter(id => completed[id] || ['closed', 'paused'].includes(closures[id]?.state)).length;
    const openLoops = tasks.filter(row => String(row.scheduledFor || '').slice(0, 10) === date && !row.completedAt).length;
    const percent = active.length ? Math.round((resolved / active.length) * 100) : 0;
    days.push({ date, resolved, total: active.length, percent, openLoops, state: resolved === active.length && openLoops === 0 ? 'complete' : resolved ? 'partial' : 'open' });
  }
  return { year, days };
}

export async function resolveDailyPractice(id, { state = 'closed', reason = '' } = {}, date = todayKey()) {
  if (!['closed', 'paused', 'open'].includes(state)) throw new Error('Unknown practice state.');
  const closures = await getPreference(`dailyClosures:${date}`, {});
  if (state === 'open') delete closures[id];
  else closures[id] = { state, reason: String(reason || '').trim(), at: new Date().toISOString() };
  await setPreference(`dailyClosures:${date}`, closures);
  return loadDailyRhythm(date);
}

export async function saveBibleReading({ book, name, chapter, verseStart = 1, verseEnd, source = 'reader' }) {
  const start = Number(verseStart);
  const end = Number(verseEnd);
  const id = `reading:WEB-C:${book}:${chapter}:${start}-${end}`;
  const saved = await put('bible', {
    id,
    kind: 'bible-reading',
    translation: 'WEB-C',
    passage: `${name} ${chapter}:${start}${end !== start ? `-${end}` : ''}`,
    book,
    bookName: name,
    chapter: Number(chapter),
    verseStart: start,
    verseEnd: end,
    source,
    completedAt: new Date().toISOString(),
  });
  await recordSpark({ kind: 'bible-reading', room: 'chapel', feature: 'bible', sourceStore: 'bible', sourceId: id, label: `${name} ${chapter} read` });
  await evaluateRoomSign('chapel');
  return saved;
}

export async function listBibleReadings() {
  return (await all('bible')).filter(row =>
    row.translation === 'WEB-C'
    && row.book
    && Number.isFinite(Number(row.chapter))
    && Number.isFinite(Number(row.verseStart))
    && Number.isFinite(Number(row.verseEnd))
    && row.completedAt
    && (!row.kind || row.kind === 'bible-reading')
  );
}

export async function getBibleStudyForPassage(book, chapter) {
  const rows = (await all('bible')).filter(row =>
    row.translation === 'WEB-C'
    && row.book === book
    && Number(row.chapter) === Number(chapter)
    && ['bible-highlight', 'bible-note', 'bible-devotional'].includes(row.kind)
  );
  return {
    highlights: rows.filter(row => row.kind === 'bible-highlight' && !row.clearedAt).sort((a, b) => Number(a.verse) - Number(b.verse)),
    notes: rows.filter(row => row.kind === 'bible-note').sort(newest),
    devotionals: rows.filter(row => row.kind === 'bible-devotional').sort(newest),
  };
}

export async function saveBibleHighlight({ book, name, chapter, verse, verseText = '', color = 'gold', note = '' }) {
  const cleanVerse = String(verse || '').trim();
  if (!book || !chapter || !cleanVerse) throw new Error('Choose a verse first.');
  const allowed = new Set(['gold', 'emerald', 'rose', 'sapphire']);
  const tone = allowed.has(color) ? color : 'gold';
  const id = `highlight:WEB-C:${book}:${chapter}:${cleanVerse}`;
  const saved = await put('bible', {
    id,
    kind: 'bible-highlight',
    translation: 'WEB-C',
    passage: `${name} ${chapter}:${cleanVerse}`,
    book,
    bookName: name,
    chapter: Number(chapter),
    verse: cleanVerse,
    verseText: String(verseText || '').trim(),
    color: tone,
    note: String(note || '').trim(),
  });
  await recordSpark({ kind: 'bible-highlight', room: 'chapel', feature: 'bible', sourceStore: 'bible', sourceId: id, label: `${name} ${chapter}:${cleanVerse} highlighted` });
  await evaluateRoomSign('chapel');
  return saved;
}

export async function clearBibleHighlight({ book, chapter, verse }) {
  const id = `highlight:WEB-C:${book}:${chapter}:${String(verse || '').trim()}`;
  return del('bible', id);
}

export async function saveBibleVerseNote({ book, name, chapter, verse, verseText = '', note = '', color = 'emerald' }) {
  const cleanNote = String(note || '').trim();
  const cleanVerse = String(verse || '').trim();
  if (!book || !chapter || !cleanVerse) throw new Error('Choose a verse first.');
  if (!cleanNote) throw new Error('Write a note first.');
  const id = `note:WEB-C:${book}:${chapter}:${cleanVerse}:${ulid()}`;
  const saved = await put('bible', {
    id,
    kind: 'bible-note',
    translation: 'WEB-C',
    passage: `${name} ${chapter}:${cleanVerse}`,
    book,
    bookName: name,
    chapter: Number(chapter),
    verse: cleanVerse,
    verseText: String(verseText || '').trim(),
    note: cleanNote,
    color,
  });
  await recordSpark({ kind: 'bible-note', room: 'chapel', feature: 'bible', sourceStore: 'bible', sourceId: id, label: `${name} ${chapter}:${cleanVerse} note` });
  await evaluateRoomSign('chapel');
  return saved;
}

export async function saveBibleDevotional({ book, name, chapter, prompt = '', selectedVerse = '', selectedText = '', observation = '', interpretation = '', application = '', prayer = '' }) {
  const fields = {
    observation: String(observation || '').trim(),
    interpretation: String(interpretation || '').trim(),
    application: String(application || '').trim(),
    prayer: String(prayer || '').trim(),
  };
  if (!Object.values(fields).some(Boolean)) throw new Error('Add one devotional reflection first.');
  const date = todayKey();
  const id = `devotional:WEB-C:${book}:${chapter}:${date}`;
  const saved = await put('bible', {
    id,
    kind: 'bible-devotional',
    translation: 'WEB-C',
    passage: `${name} ${chapter}`,
    book,
    bookName: name,
    chapter: Number(chapter),
    prompt: String(prompt || '').trim(),
    selectedVerse: String(selectedVerse || '').trim(),
    selectedText: String(selectedText || '').trim(),
    devotionalDate: date,
    ...fields,
    notes: [fields.observation, fields.interpretation, fields.application, fields.prayer].filter(Boolean).join('\n\n'),
  });
  await recordSpark({ kind: 'bible-devotional', room: 'chapel', feature: 'bible', sourceStore: 'bible', sourceId: id, label: `${name} ${chapter} devotional` });
  await evaluateRoomSign('chapel');
  return saved;
}

export async function getBiblePlan() {
  return getPreference('biblePlan', null);
}

export async function saveBiblePlan(plan) {
  return setPreference('biblePlan', plan);
}

export async function getMojiConfig() {
  const row = await get('meta', 'bitmoji');
  return row?.value || {
    gender: 'feminine',
    skinTone: 0,
    hairColor: 0,
    hairStyle: 'short',
    outfit: 'classic',
    expression: 'steady',
    aura: 'halo',
    accessory: 'hoops',
    tier: 'free',
    popups: 'on',
  };
}

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function loadMorningState(date = todayKey()) {
  const [daily, prayers, tasks] = await Promise.all([
    get('daily', date),
    all('prayers'),
    all('tasks'),
  ]);
  const onDate = value => String(value || '').slice(0, 10) === date;
  const prayer = prayers
    .filter(row => onDate(row.morningDate || row.startedOn || row.createdAt))
    .sort(newest)[0];
  const task = tasks
    .filter(row => row.morningAim === true && onDate(row.scheduledFor || row.createdAt))
    .sort(newest)[0];
  const mood = daily?.mood && Number.isFinite(Number(daily.moodScore))
    ? { word: daily.mood, score: Number(daily.moodScore) }
    : null;
  return {
    completed: { anchor: !!prayer, aim: !!task, attend: !!mood },
    entries: { anchor: prayer?.subject || '', aim: task?.title || '', attend: mood },
    sourceIds: { anchor: prayer?.id || null, aim: task?.id || null, attend: daily?.date || null },
    sign: await hasActiveSign('first-light', date) ? 'first-light' : null,
  };
}

export async function saveMorningStep(step, value, date = todayKey()) {
  let saved;
  if (step === 'anchor') {
    saved = await put('prayers', {
      id: ulid(),
      subject: String(value).trim(),
      type: 'supplication',
      cadence: 'one-off',
      intensity: 3,
      answer: 'pending',
      startedOn: date,
      morningDate: date,
    });
  } else if (step === 'aim') {
    saved = await put('tasks', {
      id: ulid(),
      title: String(value).trim(),
      priority: 'P1',
      scheduledFor: date,
      morningAim: true,
      completedAt: null,
    });
  } else if (step === 'attend') {
    const prior = await get('daily', date);
    saved = await put('daily', {
      date,
      oneSentence: '',
      gratitude: ['', '', ''],
      freeform: '',
      attachments: [],
      ...(prior || {}),
      mood: value.word,
      moodScore: Number(value.score),
      moodAt: new Date().toISOString(),
    });
  } else {
    throw new Error('Unknown morning step.');
  }
  await recordSpark({
    kind: 'morning-step',
    room: 'morning',
    feature: step,
    sourceStore: step === 'anchor' ? 'prayers' : step === 'aim' ? 'tasks' : 'daily',
    sourceId: keyFor(step === 'anchor' ? 'prayers' : step === 'aim' ? 'tasks' : 'daily', saved),
    label: step === 'anchor' ? 'Anchor placed' : step === 'aim' ? 'Course set' : 'Inner weather named',
  });
  return saved;
}

export async function awardFirstLight(date = todayKey()) {
  const state = await loadMorningState(date);
  if (!Object.values(state.completed).every(Boolean)) return null;
  const id = `sign:first-light:${date}`;
  const existing = await get('miracleLog', id);
  if (existing && existing.active !== false) return existing;
  return put('miracleLog', {
    ...(existing || {}),
    id,
    at: existing?.at || new Date().toISOString(),
    kind: 'sign',
    sign: 'first-light',
    label: 'First Light',
    copy: 'You anchored, aimed, and attended before asking the day to perform.',
    room: 'morning',
    active: true,
    evidence: Object.values(state.sourceIds).filter(Boolean),
  });
}

export async function saveFeature(featureId, values, existing = null) {
  const feature = featureFor(featureId);
  if (!feature?.store) throw new Error('This object uses a dedicated interaction.');
  const keyName = feature.store === 'daily' ? 'date' : 'id';
  const base = existing || feature.defaults?.() || {};
  const normalized = normalizeFeatureValues(featureId, values);
  const entry = {
    ...base,
    ...normalized,
    [keyName]: base[keyName] || (keyName === 'date' ? todayKey() : ulid()),
    _draft: false,
  };
  const saved = await put(feature.store, entry);
  await recordSpark({
    kind: existing ? 'record-updated' : 'record-created',
    room: feature.room,
    feature: feature.id,
    sourceStore: feature.store,
    sourceId: keyFor(feature.store, saved),
    label: existing ? `${feature.name} tended` : `${feature.name} placed`,
  });
  await evaluateRoomSign(feature.room);
  return saved;
}

export async function listFeature(featureId, options = {}) {
  const feature = featureFor(featureId);
  if (!feature?.store) return [];
  return (await all(feature.store, options)).sort(newest);
}

export async function getFeatureRecord(featureId, key) {
  const feature = featureFor(featureId);
  return feature?.store ? get(feature.store, key) : undefined;
}

export async function trashRecord(store, key) {
  const trashed = await del(store, key, { reason: 'game-user' });
  await setSourceRewardsActive(store, key, false);
  return trashed;
}

export async function restoreRecord(store, key) {
  const restored = await restore(store, key);
  await setSourceRewardsActive(store, key, true);
  return restored;
}

export async function permanentlyDeleteRecord(store, key) {
  await hardDelete(store, key);
  const events = await all('miracleLog', { includeDeleted: true, includeDrafts: true });
  for (const event of events.filter(row => row.sourceStore === store && row.sourceId === String(key))) {
    await hardDelete('miracleLog', event.id, { silent: true });
  }
}

export async function listTrash() {
  const groups = [];
  for (const store of STORE_NAMES) {
    if (store === 'miracleLog' || store === 'meta') continue;
    const rows = await all(store, { includeDeleted: true, includeDrafts: true });
    for (const row of rows.filter(item => item?._deleted || item?.deletedAt)) {
      groups.push({ store, key: keyFor(store, row), row });
    }
  }
  return groups.sort((a, b) => String(b.row.deletedAt || '').localeCompare(String(a.row.deletedAt || '')));
}

export async function searchHouse(query) {
  const needle = String(query || '').trim().toLowerCase();
  if (needle.length < 2) return [];
  const results = [];
  for (const [featureId, feature] of Object.entries(FEATURES)) {
    if (!feature.store || feature.store === 'daily' && featureId !== 'daily') continue;
    const rows = await all(feature.store).catch(() => []);
    for (const row of rows) {
      const haystack = searchableText(row);
      if (!haystack.includes(needle)) continue;
      results.push({ featureId, feature, row, key: keyFor(feature.store, row), at: row.updatedAt || row.createdAt || '' });
    }
  }
  return results.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
}

export async function projectHouseState() {
  const rooms = {};
  for (const room of Object.values(ROOMS)) {
    let count = 0;
    let completed = 0;
    const counts = {};
    for (const store of ROOM_STORES[room.id] || []) {
      const rows = await all(store).catch(() => []);
      counts[store] = rows.length;
      count += rows.length;
      if (store === 'tasks') completed += rows.filter(row => !!row.completedAt).length;
      if (store === 'focusSessions') completed += rows.filter(row => row.status === 'completed').length;
      if (store === 'projects') completed += rows.filter(row => row.phase === 'complete').length;
      if (store === 'quizzes') completed += rows.filter(row => row.status === 'mastered').length;
    }
    rooms[room.id] = {
      count,
      completed,
      counts,
      level: growthLevel(count),
      progress: growthProgress(count),
    };
  }
  const focusSessions = await all('focusSessions').catch(() => []);
  const completedFocus = focusSessions.filter(row => row.status === 'completed');
  rooms.garden.focusBlooms = completedFocus.filter(row => row.reward?.kind === 'flower').length;
  rooms.garden.focusScenes = completedFocus.filter(row => row.reward?.kind === 'scene').length;
  rooms.garden.focusRewards = completedFocus.map(row => row.reward).filter(Boolean).slice(-24);
  const sparks = (await all('miracleLog').catch(() => [])).filter(row => row.active !== false);
  const signs = sparks.filter(row => row.kind === 'sign');
  return { rooms, sparks: sparks.length, signs, records: Object.values(rooms).reduce((sum, room) => sum + room.count, 0) };
}

export async function activityFeed(limit = 30) {
  const events = (await all('miracleLog').catch(() => []))
    .filter(row => row.active !== false)
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return events.slice(0, limit);
}

export async function completeTask(id, completed = true) {
  const task = await get('tasks', id);
  if (!task) throw new Error('Task not found.');
  const saved = await put('tasks', { ...task, completedAt: completed ? new Date().toISOString() : null });
  if (completed) {
    await recordSpark({ kind: 'task-completed', room: 'workshop', feature: 'tasks', sourceStore: 'tasks', sourceId: id, label: 'A promise was kept' });
    await maybeAwardSign('kept-word', 'Kept Word', 'workshop', 3, async () => {
      const tasks = await all('tasks');
      return tasks.filter(row => !!row.completedAt).length;
    }, 'Three promises were carried from intention into completion.');
  }
  return saved;
}

const FOCUS_LINK_STORES = Object.freeze({
  task: 'tasks',
  project: 'projects',
  prayer: 'prayers',
  scripture: 'bible',
  book: 'books',
});

export async function getFocusDashboard() {
  const sessions = (await all('focusSessions').catch(() => []))
    .sort((a, b) => String(b.endedAt || b.updatedAt || '').localeCompare(String(a.endedAt || a.updatedAt || '')));
  const today = todayKey();
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const completed = sessions.filter(row => row.status === 'completed');
  const secondsFor = rows => rows.reduce((sum, row) => sum + Math.max(0, Number(row.elapsedSecs || 0)), 0);
  const todaySessions = sessions.filter(row => String(row.endedAt || row.updatedAt || '').startsWith(today));
  const weekSessions = sessions.filter(row => new Date(row.endedAt || row.updatedAt || 0) >= weekStart);
  const daily = Object.values(sessions.reduce((days, row) => {
    const date = String(row.endedAt || row.updatedAt || '').slice(0, 10);
    if (!date) return days;
    days[date] ||= { date, seconds: 0, sessions: 0, completed: 0 };
    days[date].seconds += Math.max(0, Number(row.elapsedSecs || 0));
    days[date].sessions += 1;
    if (row.status === 'completed') days[date].completed += 1;
    return days;
  }, {})).sort((a, b) => b.date.localeCompare(a.date));
  return {
    sessions,
    daily,
    todaySeconds: secondsFor(todaySessions),
    weekSeconds: secondsFor(weekSessions),
    lifetimeSeconds: secondsFor(sessions),
    completedCount: completed.length,
    bloomCount: completed.filter(row => row.reward?.kind === 'flower').length,
    sceneCount: completed.filter(row => row.reward?.kind === 'scene').length,
    quoteCount: completed.filter(row => row.reward?.kind === 'quote').length,
    rewardCount: completed.filter(row => !!row.reward).length,
    completionRate: sessions.length ? Math.round((completed.length / sessions.length) * 100) : 0,
  };
}

export async function listFocusTargets() {
  const groups = [];
  for (const [type, store] of Object.entries(FOCUS_LINK_STORES)) {
    const rows = await all(store).catch(() => []);
    groups.push({
      type,
      store,
      label: ({ task: 'Tasks', project: 'Projects', prayer: 'Prayers', scripture: 'Scripture', book: 'Books' })[type],
      items: rows
        .map(row => ({
          id: keyFor(store, row),
          label: focusTargetLabel(type, row),
          meta: focusTargetMeta(type, row),
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
        .slice(0, 80),
    });
  }
  return groups;
}

export async function saveFocusSession({
  taskLabel,
  minutes,
  elapsedSecs,
  status,
  mode = 'timed',
  linkType = 'general',
  linkId = '',
  achievement = '',
  milestone = '',
  benchmarkPercent = null,
  reward = null,
  soundMode = 'rain',
  notes = '',
}) {
  const saved = await put('focusSessions', {
    id: ulid(),
    taskId: linkType === 'task' ? linkId || null : null,
    taskLabel: String(taskLabel || '').trim(),
    mode,
    durationMins: Number(minutes),
    elapsedSecs: Number(elapsedSecs),
    status,
    linkType,
    linkStore: FOCUS_LINK_STORES[linkType] || null,
    linkId: String(linkId || ''),
    achievement: String(achievement || '').trim(),
    milestone: String(milestone || '').trim(),
    benchmarkPercent: benchmarkPercent === '' || benchmarkPercent == null ? null : Math.max(0, Math.min(100, Number(benchmarkPercent))),
    reward,
    soundMode,
    startedAt: new Date(Date.now() - Number(elapsedSecs) * 1000).toISOString(),
    endedAt: new Date().toISOString(),
    notes,
    xp: 0,
  });
  await appendFocusToLinkedRecord(saved);
  await recordSpark({ kind: 'focus-session', room: 'workshop', feature: 'focus', sourceStore: 'focusSessions', sourceId: saved.id, label: status === 'completed' ? 'Deep work completed' : 'Focus honestly recorded' });
  if (status === 'completed') {
    await maybeAwardSign('deep-well', 'Deep Well', 'workshop', 3, async () => {
      const rows = await all('focusSessions');
      return rows.filter(row => row.status === 'completed').length;
    }, 'Three completed focus chambers deepened the Workshop.');
  }
  return saved;
}

async function appendFocusToLinkedRecord(session) {
  const store = session.linkStore;
  if (!store || !session.linkId) return;
  const record = await get(store, session.linkId);
  if (!record) return;
  const focusLog = Array.isArray(record.focusLog) ? record.focusLog.slice(-99) : [];
  focusLog.push({
    sessionId: session.id,
    at: session.endedAt,
    elapsedSecs: session.elapsedSecs,
    status: session.status,
    achievement: session.achievement,
    milestone: session.milestone,
    benchmarkPercent: session.benchmarkPercent,
    reward: session.reward?.name || '',
  });
  await put(store, {
    ...record,
    focusLog,
    focusSecondsTotal: Math.max(0, Number(record.focusSecondsTotal || 0)) + Math.max(0, Number(session.elapsedSecs || 0)),
    lastFocusAt: session.endedAt,
    latestFocusAchievement: session.achievement || record.latestFocusAchievement || '',
    latestMilestone: session.milestone || record.latestMilestone || '',
    benchmarkPercent: session.benchmarkPercent ?? record.benchmarkPercent ?? null,
  });
}

function focusTargetLabel(type, row) {
  if (type === 'task' || type === 'project' || type === 'book') return String(row.title || row.taskLabel || 'Untitled');
  if (type === 'prayer') return String(row.subject || row.title || 'Prayer');
  if (type === 'scripture') return String(row.passage || row.title || 'Scripture reading');
  return 'Focus record';
}

function focusTargetMeta(type, row) {
  if (type === 'task') return row.completedAt ? 'complete' : row.priority || 'open';
  if (type === 'project') return row.phase || 'project';
  if (type === 'prayer') return row.status || row.type || 'prayer';
  if (type === 'scripture') return row.translation || row.bookName || 'Bible';
  if (type === 'book') return row.status || row.author || 'reading';
  return '';
}

export async function saveBookMarks(date, changes) {
  const prior = await get('daily', date) || { date, oneSentence: '', gratitude: ['', '', ''], freeform: '', attachments: [] };
  const saved = await put('daily', { ...prior, ...changes });
  await recordSpark({ kind: 'book-mark', room: 'archive', feature: 'book', sourceStore: 'daily', sourceId: date, label: 'A page was illuminated' });
  await evaluateRoomSign('archive');
  return saved;
}

export async function getDailySpread(date = todayKey()) {
  const page = await get('daily', date);
  const events = [];
  for (const feature of Object.values(FEATURES)) {
    if (!feature.store || feature.store === 'daily') continue;
    const rows = await all(feature.store).catch(() => []);
    rows.filter(row => String(row.updatedAt || row.createdAt || '').startsWith(date)).forEach(row => {
      events.push({ feature, row, at: row.updatedAt || row.createdAt || '' });
    });
  }
  return { page: page || { date, oneSentence: '', gratitude: ['', '', ''], freeform: '', attachments: [] }, events: events.sort((a, b) => a.at.localeCompare(b.at)) };
}

function normalizeFeatureValues(featureId, values) {
  const normalized = { ...values };
  if (featureId === 'daily') {
    normalized.gratitude = [values.gratitudeOne || '', '', ''];
    delete normalized.gratitudeOne;
  }
  if (featureId === 'meals') normalized.actualItems = String(values.actualItems || '').split(',').map(x => x.trim()).filter(Boolean);
  if (featureId === 'dreams') normalized.symbols = String(values.symbols || '').split(',').map(x => x.trim()).filter(Boolean);
  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value === 'string') normalized[key] = value.trim();
    if (['amountGhs', 'costGhs', 'estMinutes', 'intensity'].includes(key) && value !== '') normalized[key] = Number(value);
  }
  return normalized;
}

async function recordSpark(event) {
  const sourceId = String(event.sourceId);
  const id = `spark:${event.kind}:${event.sourceStore}:${sourceId}`;
  const existing = await get('miracleLog', id);
  const saved = await put('miracleLog', {
    ...(existing || {}),
    ...event,
    id,
    sourceId,
    at: existing?.at || new Date().toISOString(),
    active: true,
  });
  window.dispatchEvent(new CustomEvent('game:data-changed', { detail: { room: event.room, feature: event.feature } }));
  return saved;
}

async function setSourceRewardsActive(store, key, active) {
  const events = await all('miracleLog', { includeDeleted: true, includeDrafts: true });
  for (const event of events.filter(row => row.sourceStore === store && row.sourceId === String(key))) {
    await put('miracleLog', { ...event, active });
  }
}

async function maybeAwardSign(sign, label, room, threshold, count, copy = '') {
  if ((await count()) < threshold) return null;
  const id = `sign:${sign}`;
  const existing = await get('miracleLog', id);
  if (existing) return existing;
  return put('miracleLog', { id, at: new Date().toISOString(), kind: 'sign', sign, label, copy, room, active: true });
}

async function evaluateRoomSign(room) {
  if (room === 'chapel') {
    return maybeAwardSign('watchfire', 'Watchfire', room, 5, () => countRecords(['prayers', 'bible', 'fasts', 'prophecies', 'testimonies', 'music']), 'Five faithful records have kept the Chapel light burning.');
  }
  if (room === 'garden') {
    return maybeAwardSign('good-ground', 'Good Ground', room, 5, () => countRecords(['meals', 'transactions', 'people', 'books']), 'Five acts of practical care have taken root in the Garden.');
  }
  if (room === 'archive') {
    return maybeAwardSign('golden-thread', 'Golden Thread', room, 3, async () => {
      const [daily, dreams] = await Promise.all([all('daily'), all('dreams')]);
      const illuminated = daily.filter(row => [row.bookHighlights, row.bookNotes, row.bookStickers].some(value => Array.isArray(value) && value.length)).length;
      return illuminated + dreams.length;
    }, 'Three illuminated pages or preserved dreams now form a thread you can follow.');
  }
  return null;
}

async function countRecords(stores) {
  const groups = await Promise.all(stores.map(store => all(store).catch(() => [])));
  return groups.reduce((sum, rows) => sum + rows.length, 0);
}

async function hasActiveSign(sign, date) {
  const row = await get('miracleLog', `sign:${sign}:${date}`);
  return !!row && row.active !== false;
}

function keyFor(store, row) {
  return String(store === 'daily' || store === 'fti' ? row.date : store === 'meta' ? row.key : row.id);
}

function searchableText(value) {
  const seen = new Set();
  const collect = item => {
    if (item == null) return '';
    if (typeof item === 'string' || typeof item === 'number') return String(item);
    if (typeof item !== 'object' || seen.has(item)) return '';
    seen.add(item);
    return Object.entries(item)
      .filter(([key]) => !['attachments', 'createdAt', 'updatedAt'].includes(key))
      .map(([, child]) => collect(child))
      .join(' ');
  };
  return collect(value).toLowerCase();
}

function recordMatchesDate(row, date) {
  const candidates = [row.morningDate, row.date, row.dreamDate, row.dateReceived, row.scheduledFor, row.startedOn, row.startedAt, row.startAt, row.completedAt, row.createdAt, row.updatedAt];
  return candidates.some(value => String(value || '').slice(0, 10) === date);
}

function newest(a, b) {
  return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
}

function growthLevel(count) {
  if (count >= 50) return 4;
  if (count >= 20) return 3;
  if (count >= 7) return 2;
  if (count >= 1) return 1;
  return 0;
}

function growthProgress(count) {
  const thresholds = [0, 1, 7, 20, 50, 100];
  const level = growthLevel(count);
  const start = thresholds[level];
  const end = thresholds[level + 1];
  return Math.max(0, Math.min(1, (count - start) / (end - start)));
}

export function roomForStore(store) {
  return STORE_ROOM[store] || 'archive';
}
