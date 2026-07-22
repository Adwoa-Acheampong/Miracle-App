import { icon } from './game-icons.js?v=__BUILD__';
import {
  DAILY_PRACTICES,
  getDailyRule,
  saveDailyRule,
  loadDailyRhythm,
  resolveDailyPractice,
  loadYearOfLight,
  completeTask,
  listBibleReadings,
  saveBibleReading,
  getBiblePlan,
  saveBiblePlan,
  todayKey,
} from './data.js?v=__BUILD__';
import { esc } from '../util/esc.js?v=__BUILD__';
import { buildPlanPortions, countCompletedPlanDays, selectCurrentPlanPortion } from './bible-plan.js?v=__BUILD__';

const WISDOM = Object.freeze([
  {
    kind: 'Language note',
    title: 'Nes carries more than one image',
    copy: 'In Biblical Hebrew, nes most often means a raised banner, signal, or sign. In later Hebrew it commonly means a miracle: something made visible that points beyond itself.',
    source: 'Brown-Driver-Briggs Hebrew Lexicon',
    url: 'https://biblehub.com/hebrew/5251.htm',
  },
  {
    kind: 'Research note',
    title: 'Rhythm grows through return',
    copy: 'Habit automaticity develops through repeated action in a stable context, but the pace differs widely between people. A missed day is not proof that the practice failed.',
    source: 'Lally et al., European Journal of Social Psychology',
    url: 'https://onlinelibrary.wiley.com/doi/abs/10.1002/ejsp.674',
  },
  {
    kind: 'Research note',
    title: 'Choice helps practice become your own',
    copy: 'Lasting motivation is better supported when people experience autonomy, competence, and connection. This is why your Rule of Life remains yours to choose and revise.',
    source: 'Ryan and Deci, Self-Determination Theory',
    url: 'https://doi.org/10.1207/S15327965PLI1104_01',
  },
  {
    kind: 'Research note',
    title: 'Prayer research needs careful language',
    copy: 'Brain-imaging studies find neural correlates during prayer and Scripture recitation, but they do not prove that prayer causes one universal change in brain structure.',
    source: 'Systematic review and meta-analysis, 2025',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11926137/',
  },
  {
    kind: 'Research note',
    title: 'Autophagy is real; human timing is not settled',
    copy: 'Nutrient restriction can affect cellular recycling processes. Human evidence is still developing, so Miracle will not prescribe a fasting duration or turn an early finding into a medical promise.',
    source: 'Bensalem et al., Journal of Physiology',
    url: 'https://pubmed.ncbi.nlm.nih.gov/40345145/',
  },
]);

const OFFERINGS = Object.freeze([
  { book: 'PSA', chapter: 90, verse: 12, prompt: 'Number the day by choosing what deserves your life today.' },
  { book: 'PRO', chapter: 16, verse: 3, prompt: 'Commit the work, then make the next action visible.' },
  { book: 'MAT', chapter: 6, verse: 33, prompt: 'Let first things be first before urgency starts speaking.' },
  { book: 'JAS', chapter: 1, verse: 5, prompt: 'Ask for wisdom, then record the decision it leads you toward.' },
  { book: 'TOB', chapter: 4, verse: 7, prompt: 'Make care concrete through one act of generosity or attention.' },
  { book: 'PHP', chapter: 4, verse: 8, prompt: 'Name what is true before rehearsing what is frightening.' },
  { book: 'ECC', chapter: 3, verse: 1, prompt: 'Notice the season. Choose a fitting action, not every action.' },
]);

const PRACTICE_FEATURE = Object.freeze({
  devotion: 'prayer', priority: 'tasks', mood: 'daily', dream: 'dreams', schedule: 'schedule', meal: 'meals', song: 'music', word: 'prophecy',
});

export function createRhythmBibleUI({ openSpecial, openFeature, showToast, soundscape, pulseHaptic }) {
  const rhythmWorld = document.getElementById('rhythm-world');
  const bibleWorld = document.getElementById('bible-world');
  const reader = document.getElementById('scripture-reader');
  let manifest = null;
  let readings = [];
  let currentBook = 'PSA';
  let currentChapter = 1;
  let activeRange = null;
  let speech = null;

  bindRhythm();
  bindBible();

  return { openRhythm, openBible, stopAudio };

  async function openRhythm() {
    openSpecial(rhythmWorld);
    await renderRhythm();
  }

  async function renderRhythm() {
    const [rhythm, year, offering] = await Promise.all([loadDailyRhythm(), loadYearOfLight(), loadOffering()]);
    const percent = rhythm.total ? Math.round((rhythm.resolved / rhythm.total) * 100) : 0;
    document.getElementById('rhythm-count').textContent = `${rhythm.resolved}/${rhythm.total}`;
    document.getElementById('rhythm-meter').style.setProperty('--rhythm-progress', `${percent * 3.6}deg`);
    document.getElementById('practice-status').textContent = rhythm.complete ? 'day resolved' : `${rhythm.total - rhythm.resolved} remain`;
    document.getElementById('offering-scripture').innerHTML = `<q>${esc(offering.text)}</q><cite>${esc(offering.name)} ${offering.chapter}:${offering.verse}</cite><span>${esc(offering.prompt)}</span>`;

    const wisdom = WISDOM[dayIndex(WISDOM.length)];
    document.getElementById('wisdom-kind').textContent = wisdom.kind;
    document.getElementById('wisdom-title').textContent = wisdom.title;
    document.getElementById('wisdom-copy').textContent = wisdom.copy;
    const source = document.getElementById('wisdom-source');
    source.textContent = wisdom.source;
    source.href = wisdom.url;

    const plan = await getBiblePlan();
    const due = currentPlanPortion(plan);
    const dueBook = due ? (plan?.bookName || plan?.name?.replace(/ in .+$/i, '') || 'Scripture') : '';
    document.getElementById('assignment-title').textContent = due ? `Read ${dueBook} ${due.chapter}:${due.verseStart}-${due.verseEnd}` : 'Carry one line into action';
    document.getElementById('assignment-copy').textContent = due ? 'Your reading path is waiting in the Chapel.' : offering.prompt;

    const path = document.getElementById('practice-path');
    path.innerHTML = rhythm.practices.map(item => `
      <article class="practice-step" data-state="${item.state}">
        <span class="practice-mark">${icon(item.state === 'complete' ? 'check' : item.icon, { size: 18 })}</span>
        <button type="button" data-practice-open="${item.id}"><strong>${esc(item.label)}</strong><small>${practiceStateLabel(item.state)}</small></button>
        <button class="practice-resolve" type="button" data-practice-resolve="${item.id}" data-state="${item.state}" aria-label="${item.state === 'open' ? 'Close' : 'Reopen'} ${esc(item.label)}">${icon(item.state === 'open' ? 'minus' : 'rotate-ccw', { size: 16 })}</button>
      </article>
    `).join('');

    document.getElementById('open-loop-count').textContent = rhythm.openLoops.length ? `${rhythm.openLoops.length} open` : 'clear';
    document.getElementById('open-loop-path').innerHTML = rhythm.openLoops.length ? rhythm.openLoops.map(task => `
      <article class="open-loop"><button type="button" data-loop-complete="${esc(task.id)}" aria-label="Complete ${esc(task.title)}">${icon('circle', { size: 18 })}</button><span><strong>${esc(task.title)}</strong><small>${esc(task.estMinutes ? `${task.estMinutes} min` : 'scheduled today')}</small></span></article>
    `).join('') : '<p class="quiet-empty">No scheduled work is waiting.</p>';

    const yearGrid = document.getElementById('year-light');
    yearGrid.innerHTML = year.days.map(day => `<i data-state="${day.state}" style="--day-light:${day.percent}%" title="${day.date}: ${day.percent}%"></i>`).join('');
    const completeDays = year.days.filter(day => day.state === 'complete').length;
    document.getElementById('year-light-value').textContent = `${completeDays} lit`;
  }

  function bindRhythm() {
    rhythmWorld.addEventListener('click', async event => {
      const practiceButton = event.target.closest('[data-practice-open]');
      if (practiceButton) {
        const featureId = PRACTICE_FEATURE[practiceButton.dataset.practiceOpen];
        if (featureId) openFeature(featureId);
        return;
      }
      const resolveButton = event.target.closest('[data-practice-resolve]');
      if (resolveButton) {
        await resolveDailyPractice(resolveButton.dataset.practiceResolve, { state: resolveButton.dataset.state === 'open' ? 'closed' : 'open' });
        pulseHaptic(6);
        await renderRhythm();
        return;
      }
      const loopButton = event.target.closest('[data-loop-complete]');
      if (loopButton) {
        await completeTask(loopButton.dataset.loopComplete, true);
        soundscape.confirm?.(1);
        await renderRhythm();
      }
    });
    document.getElementById('rhythm-edit').addEventListener('click', openRuleEditor);
    document.getElementById('rule-editor-close').addEventListener('click', () => { document.getElementById('rule-editor').hidden = true; });
    document.getElementById('rule-save').addEventListener('click', saveRuleEditor);
  }

  async function openRuleEditor() {
    const rule = await getDailyRule();
    const editor = document.getElementById('rule-editor');
    document.getElementById('rule-options').innerHTML = DAILY_PRACTICES.map(item => `
      <label class="rule-option"><input type="checkbox" value="${item.id}" ${rule.practices.includes(item.id) ? 'checked' : ''}><span>${icon(item.icon, { size: 18 })}<strong>${esc(item.label)}</strong></span></label>
    `).join('');
    editor.hidden = false;
  }

  async function saveRuleEditor() {
    const current = await getDailyRule();
    const practices = [...document.querySelectorAll('#rule-options input:checked')].map(input => input.value);
    try {
      await saveDailyRule({ ...current, practices });
      document.getElementById('rule-editor').hidden = true;
      await renderRhythm();
      showToast('Your daily rule now begins today.');
    } catch (error) {
      showToast(error.message);
    }
  }

  async function loadOffering() {
    const offering = OFFERINGS[dayIndex(OFFERINGS.length)];
    const chapter = await fetchChapter(offering.book, offering.chapter);
    const verse = chapter.verses.find(item => String(item.number) === String(offering.verse));
    return { ...offering, name: chapter.name, text: verse?.text || offering.prompt };
  }

  async function openBible({ book = null, chapter = null, range = null } = {}) {
    openSpecial(bibleWorld);
    manifest ||= await fetchJson('./bible/web-c/manifest.json');
    readings = await listBibleReadings();
    currentBook = book || currentBook || 'PSA';
    currentChapter = Number(chapter || currentChapter || 1);
    activeRange = range;
    hydrateBibleSelectors();
    await renderBible();
  }

  function bindBible() {
    document.getElementById('bible-book').addEventListener('change', async event => {
      currentBook = event.target.value;
      currentChapter = 1;
      activeRange = null;
      hydrateChapterSelect();
      await renderBible();
    });
    document.getElementById('bible-chapter').addEventListener('change', async event => {
      currentChapter = Number(event.target.value);
      activeRange = null;
      await renderBible();
    });
    document.getElementById('bible-prev').addEventListener('click', () => moveChapter(-1));
    document.getElementById('bible-next').addEventListener('click', () => moveChapter(1));
    document.getElementById('bible-audio').addEventListener('click', toggleAudio);
    document.getElementById('bible-complete').addEventListener('click', markCurrentReading);
    document.getElementById('bible-library-toggle').addEventListener('click', openBibleLibrary);
    document.getElementById('bible-library-close').addEventListener('click', () => { document.getElementById('bible-library').hidden = true; });
    document.getElementById('tobit-plan-start').addEventListener('click', startTobitPlan);
    document.getElementById('bible-goal-start').addEventListener('click', startSelectedBibleGoal);
    document.getElementById('bible-book-grid').addEventListener('click', async event => {
      const button = event.target.closest('[data-bible-book]');
      if (!button) return;
      document.getElementById('bible-library').hidden = true;
      currentBook = button.dataset.bibleBook;
      currentChapter = 1;
      activeRange = null;
      hydrateBibleSelectors();
      await renderBible();
    });
    document.getElementById('bible-plan').addEventListener('click', async event => {
      const button = event.target.closest('[data-plan-portion]');
      if (!button) return;
      const plan = await getBiblePlan();
      const portion = plan?.portions?.[Number(button.dataset.planPortion)];
      if (portion) await openBible({ book: portion.book || plan.book || 'TOB', chapter: portion.chapter, range: portion });
    });
  }

  function hydrateBibleSelectors() {
    const bookSelect = document.getElementById('bible-book');
    bookSelect.innerHTML = manifest.books.map(book => `<option value="${book.id}" ${book.id === currentBook ? 'selected' : ''}>${esc(book.name)}</option>`).join('');
    hydrateChapterSelect();
  }

  function hydrateChapterSelect() {
    const book = bibleBook();
    const chapterSelect = document.getElementById('bible-chapter');
    chapterSelect.innerHTML = Array.from({ length: book.chapters }, (_, index) => `<option value="${index + 1}" ${index + 1 === currentChapter ? 'selected' : ''}>${index + 1}</option>`).join('');
  }

  async function renderBible() {
    stopAudio();
    const chapter = await fetchChapter(currentBook, currentChapter);
    const rangeStart = Number(activeRange?.verseStart || 1);
    const rangeEnd = Number(activeRange?.verseEnd || chapter.verses.at(-1)?.number || 1);
    document.getElementById('bible-title').textContent = `${chapter.name} ${chapter.chapter}`;
    reader.innerHTML = `<header><p>World English Bible Catholic Edition</p><h3>${esc(chapter.name)} ${chapter.chapter}</h3></header>${chapter.verses.map(verse => {
      const number = Number(String(verse.number).split('-')[0]);
      const due = activeRange && number >= rangeStart && number <= rangeEnd;
      return `<p class="scripture-verse ${due ? 'is-due' : ''}" data-verse="${esc(verse.number)}"><sup>${esc(verse.number)}</sup>${esc(verse.text)}</p>`;
    }).join('')}<footer>Public domain text. Source: eBible.org.</footer>`;
    const existing = readings.some(row => row.book === currentBook && Number(row.chapter) === currentChapter && Number(row.verseStart) <= rangeStart && Number(row.verseEnd) >= rangeEnd);
    const complete = document.getElementById('bible-complete');
    complete.disabled = existing;
    complete.querySelector('span').textContent = existing ? 'Read' : activeRange ? "Complete today's verses" : 'Mark chapter read';
    await renderBiblePlan();
    if (activeRange) reader.querySelector('.is-due')?.scrollIntoView({ block: 'start' });
  }

  async function moveChapter(direction) {
    const bookIndex = manifest.books.findIndex(book => book.id === currentBook);
    const book = manifest.books[bookIndex];
    if (currentChapter + direction >= 1 && currentChapter + direction <= book.chapters) currentChapter += direction;
    else if (direction > 0 && manifest.books[bookIndex + 1]) { currentBook = manifest.books[bookIndex + 1].id; currentChapter = 1; }
    else if (direction < 0 && manifest.books[bookIndex - 1]) { currentBook = manifest.books[bookIndex - 1].id; currentChapter = manifest.books[bookIndex - 1].chapters; }
    activeRange = null;
    hydrateBibleSelectors();
    await renderBible();
  }

  async function markCurrentReading() {
    const chapter = await fetchChapter(currentBook, currentChapter);
    const verseStart = Number(activeRange?.verseStart || 1);
    const verseEnd = Number(activeRange?.verseEnd || chapter.verses.at(-1)?.number || 1);
    await saveBibleReading({ book: currentBook, name: chapter.name, chapter: currentChapter, verseStart, verseEnd, source: speech ? 'audio' : 'reader' });
    readings = await listBibleReadings();
    const plan = await getBiblePlan();
    if (plan) {
      const now = new Date().toISOString();
      plan.portions.forEach(portion => {
        const portionBook = portion.book || plan.book || 'TOB';
        const covered = portionBook === currentBook && portion.chapter === currentChapter && verseStart <= portion.verseStart && verseEnd >= portion.verseEnd;
        if (covered) portion.completedAt = portion.completedAt || now;
      });
      await saveBiblePlan(plan);
    }
    soundscape.confirm?.(0);
    pulseHaptic([8, 24, 10]);
    showToast(`${chapter.name} ${currentChapter} recorded.`);
    await renderBible();
  }

  function toggleAudio() {
    if (!('speechSynthesis' in window)) return showToast('Audio reading is not available on this device.');
    if (speech) return stopAudio();
    const verses = [...reader.querySelectorAll(activeRange ? '.scripture-verse.is-due' : '.scripture-verse')].map(node => node.textContent).join(' ');
    speech = new SpeechSynthesisUtterance(verses);
    speech.rate = 0.92;
    speech.pitch = 0.95;
    speech.onend = speech.onerror = () => { speech = null; paintAudio(false); };
    window.speechSynthesis.speak(speech);
    paintAudio(true);
  }

  function stopAudio() {
    if (!speech) return;
    window.speechSynthesis?.cancel();
    speech = null;
    paintAudio(false);
  }

  function paintAudio(active) {
    const button = document.getElementById('bible-audio');
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-label', active ? 'Stop reading' : 'Read chapter aloud');
    button.innerHTML = icon(active ? 'pause' : 'volume', { size: 18 });
  }

  async function renderBiblePlan() {
    const plan = await getBiblePlan();
    const host = document.getElementById('bible-plan');
    if (!plan) {
      host.innerHTML = '<span>Reading plan</span><strong>No active plan</strong><button type="button" data-open-library>Choose in progress</button>';
      host.querySelector('button').addEventListener('click', openBibleLibrary, { once: true });
      return;
    }
    const portion = currentPlanPortion(plan);
    const durationDays = Number(plan.durationDays || Math.max(...plan.portions.map(item => Number(item.day || 1))));
    const completedDays = countCompletedPlanDays(plan);
    const label = plan.name || `${plan.bookName || 'Bible'} reading goal`;
    host.innerHTML = `<span>${esc(label)}</span><strong>${completedDays} of ${durationDays} days</strong>${portion ? `<button type="button" data-plan-portion="${plan.portions.indexOf(portion)}">Today: ${portion.chapter}:${portion.verseStart}-${portion.verseEnd}</button>` : '<small>Plan complete</small>'}`;
  }

  async function openBibleLibrary() {
    manifest ||= await fetchJson('./bible/web-c/manifest.json');
    readings = await listBibleReadings();
    const coverage = readingCoverage(readings);
    let completedVerses = 0;
    let totalVerses = 0;
    document.getElementById('bible-book-grid').innerHTML = manifest.books.map(book => {
      const total = book.verseCounts.reduce((sum, count) => sum + count, 0);
      const read = coverage.get(book.id)?.size || 0;
      totalVerses += total;
      completedVerses += read;
      const percent = total ? Math.round((read / total) * 100) : 0;
      return `<button type="button" data-bible-book="${book.id}" style="--book-progress:${percent}%"><strong>${esc(book.name)}</strong><small>${percent}%</small><i></i></button>`;
    }).join('');
    const percent = totalVerses ? Math.round((completedVerses / totalVerses) * 100) : 0;
    document.getElementById('bible-progress-summary').innerHTML = `<strong>${percent}%</strong><span>${completedVerses.toLocaleString()} of ${totalVerses.toLocaleString()} verses illuminated</span>`;
    document.getElementById('bible-goal-book').innerHTML = manifest.books.map(book => `<option value="${book.id}" ${book.id === currentBook ? 'selected' : ''}>${esc(book.name)}</option>`).join('');
    document.getElementById('bible-library').hidden = false;
  }

  async function startTobitPlan() {
    await startBibleGoal('TOB', 28, 'Tobit in four weeks');
  }

  async function startSelectedBibleGoal() {
    const book = document.getElementById('bible-goal-book').value;
    const days = Number(document.getElementById('bible-goal-days').value || 28);
    await startBibleGoal(book, days);
  }

  async function startBibleGoal(bookId, days, customName = '') {
    manifest ||= await fetchJson('./bible/web-c/manifest.json');
    const book = manifest.books.find(item => item.id === bookId);
    if (!book) return showToast('That book could not be loaded.');
    const durationDays = Math.min(Math.max(1, Number(days || 28)), book.verseCounts.reduce((sum, count) => sum + count, 0));
    const portions = buildPlanPortions(book, durationDays);
    const plan = {
      id: `${book.id.toLowerCase()}-${durationDays}-${todayKey()}`,
      name: customName || `${book.name} in ${durationDays} days`,
      book: book.id,
      bookName: book.name,
      durationDays,
      startedOn: todayKey(),
      portions,
    };
    await saveBiblePlan(plan);
    document.getElementById('bible-library').hidden = true;
    showToast(`${book.name} begins today. One portion at a time.`);
    const first = portions[0];
    await openBible({ book: book.id, chapter: first.chapter, range: first });
  }

  function bibleBook() {
    return manifest.books.find(book => book.id === currentBook) || manifest.books[0];
  }
}

async function fetchChapter(book, chapter) {
  return fetchJson(`./bible/web-c/${book}/${String(chapter).padStart(3, '0')}.json`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.json();
}

function dayIndex(length) {
  const date = new Date();
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000) % length;
}

function practiceStateLabel(state) {
  if (state === 'complete') return 'recorded';
  if (state === 'closed') return 'intentionally closed';
  if (state === 'paused') return 'paused for this season';
  return 'open today';
}

function currentPlanPortion(plan) {
  return selectCurrentPlanPortion(plan, todayKey());
}

function readingCoverage(readings) {
  const coverage = new Map();
  readings.forEach(reading => {
    const set = coverage.get(reading.book) || new Set();
    for (let verse = Number(reading.verseStart); verse <= Number(reading.verseEnd); verse += 1) set.add(`${reading.chapter}:${verse}`);
    coverage.set(reading.book, set);
  });
  return coverage;
}
