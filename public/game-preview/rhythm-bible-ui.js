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
  getBibleStudyForPassage,
  saveBibleHighlight,
  clearBibleHighlight,
  saveBibleVerseNote,
  saveBibleDevotional,
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

const DEVOTIONAL_PROMPTS = Object.freeze([
  'What does this passage reveal about the character of God?',
  'What invitation, warning, or comfort is asking for a response today?',
  'Where does this word meet your actual life this week?',
  'What should be carried into prayer before you move on?',
  'What obedience would make this passage visible by tonight?',
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
  let currentChapterData = null;
  let studyState = { highlights: [], notes: [], devotionals: [] };
  let selectedVerse = null;
  let selectedHighlightColor = 'gold';

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
      selectedVerse = null;
      hydrateChapterSelect();
      await renderBible();
    });
    document.getElementById('bible-chapter').addEventListener('change', async event => {
      currentChapter = Number(event.target.value);
      activeRange = null;
      selectedVerse = null;
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
    reader.addEventListener('click', event => {
      const verse = event.target.closest('.scripture-verse');
      if (!verse) return;
      selectBibleVerse(verse.dataset.verse);
    });
    document.querySelectorAll('[data-bible-highlight]').forEach(button => {
      button.addEventListener('click', () => applyBibleHighlight(button.dataset.bibleHighlight));
    });
    document.getElementById('bible-note-save').addEventListener('click', saveSelectedVerseNote);
    document.getElementById('bible-devotional-save').addEventListener('click', saveCurrentDevotional);
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
    currentChapterData = chapter;
    studyState = await getBibleStudyForPassage(currentBook, currentChapter);
    const rangeStart = Number(activeRange?.verseStart || 1);
    const rangeEnd = Number(activeRange?.verseEnd || chapter.verses.at(-1)?.number || 1);
    const highlightMap = new Map(studyState.highlights.map(mark => [String(mark.verse), mark]));
    const noteVerses = new Set(studyState.notes.map(note => String(note.verse)));
    document.getElementById('bible-title').textContent = `${chapter.name} ${chapter.chapter}`;
    reader.innerHTML = `<header><p>World English Bible Catholic Edition</p><h3>${esc(chapter.name)} ${chapter.chapter}</h3></header>${chapter.verses.map(verse => {
      const number = Number(String(verse.number).split('-')[0]);
      const due = activeRange && number >= rangeStart && number <= rangeEnd;
      const mark = highlightMap.get(String(verse.number));
      const classes = [
        'scripture-verse',
        due ? 'is-due' : '',
        mark ? `mark-${mark.color || 'gold'}` : '',
        noteVerses.has(String(verse.number)) || mark?.note ? 'has-note' : '',
        selectedVerse?.number === String(verse.number) ? 'is-selected' : '',
      ].filter(Boolean).join(' ');
      return `<p class="${classes}" data-verse="${esc(verse.number)}"><sup>${esc(verse.number)}</sup>${esc(verse.text)}</p>`;
    }).join('')}<footer>Public domain text. Source: eBible.org.</footer>`;
    const existing = readings.some(row => row.book === currentBook && Number(row.chapter) === currentChapter && Number(row.verseStart) <= rangeStart && Number(row.verseEnd) >= rangeEnd);
    const complete = document.getElementById('bible-complete');
    complete.disabled = existing;
    complete.querySelector('span').textContent = existing ? 'Read' : activeRange ? "Complete today's verses" : 'Mark chapter read';
    renderBibleStudyDesk(chapter);
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
    selectedVerse = null;
    hydrateBibleSelectors();
    await renderBible();
  }

  function selectBibleVerse(number) {
    const verse = currentChapterData?.verses.find(item => String(item.number) === String(number));
    if (!verse) return;
    selectedVerse = { number: String(verse.number), text: verse.text };
    reader.querySelectorAll('.scripture-verse').forEach(node => node.classList.toggle('is-selected', node.dataset.verse === selectedVerse.number));
    renderBibleStudyDesk(currentChapterData);
    pulseHaptic(4);
  }

  async function applyBibleHighlight(color) {
    if (!selectedVerse || !currentChapterData) return showToast('Tap a verse first.');
    if (color === 'clear') {
      await clearBibleHighlight({ book: currentBook, chapter: currentChapter, verse: selectedVerse.number });
      showToast(`${currentChapterData.name} ${currentChapter}:${selectedVerse.number} cleared.`);
    } else {
      selectedHighlightColor = color || selectedHighlightColor;
      await saveBibleHighlight({
        book: currentBook,
        name: currentChapterData.name,
        chapter: currentChapter,
        verse: selectedVerse.number,
        verseText: selectedVerse.text,
        color: selectedHighlightColor,
        note: document.getElementById('bible-verse-note').value,
      });
      soundscape.confirm?.(0.4);
      showToast(`${currentChapterData.name} ${currentChapter}:${selectedVerse.number} highlighted.`);
    }
    await renderBible();
  }

  async function saveSelectedVerseNote() {
    if (!selectedVerse || !currentChapterData) return showToast('Tap a verse first.');
    const noteInput = document.getElementById('bible-verse-note');
    await saveBibleVerseNote({
      book: currentBook,
      name: currentChapterData.name,
      chapter: currentChapter,
      verse: selectedVerse.number,
      verseText: selectedVerse.text,
      note: noteInput.value,
      color: selectedHighlightColor,
    });
    noteInput.value = '';
    soundscape.confirm?.(0.8);
    showToast('Bible note saved.');
    await renderBible();
  }

  async function saveCurrentDevotional() {
    if (!currentChapterData) return;
    await saveBibleDevotional({
      book: currentBook,
      name: currentChapterData.name,
      chapter: currentChapter,
      prompt: devotionalPrompt(),
      selectedVerse: selectedVerse?.number || '',
      selectedText: selectedVerse?.text || '',
      observation: document.getElementById('bible-observation').value,
      interpretation: document.getElementById('bible-interpretation').value,
      application: document.getElementById('bible-application').value,
      prayer: document.getElementById('bible-prayer').value,
    });
    ['bible-observation', 'bible-interpretation', 'bible-application', 'bible-prayer'].forEach(id => { document.getElementById(id).value = ''; });
    soundscape.confirm?.(1);
    showToast('Devotional saved to Bible notes.');
    await renderBible();
  }

  function renderBibleStudyDesk(chapter) {
    const selected = selectedVerse;
    const selectedMark = selected ? studyState.highlights.find(mark => String(mark.verse) === selected.number) : null;
    if (selectedMark?.color) selectedHighlightColor = selectedMark.color;
    document.getElementById('bible-selected-label').textContent = selected ? `${chapter.name} ${chapter.chapter}:${selected.number}` : 'Tap a verse';
    document.getElementById('bible-devotional-prompt').textContent = devotionalPrompt();
    const noteInput = document.getElementById('bible-verse-note');
    if (selected && document.activeElement !== noteInput) noteInput.value = selectedMark?.note || '';
    if (!selected && document.activeElement !== noteInput) noteInput.value = '';
    document.querySelectorAll('[data-bible-highlight]').forEach(button => {
      button.classList.toggle('is-active', selected && button.dataset.bibleHighlight === selectedHighlightColor);
    });
    const feed = document.getElementById('bible-note-feed');
    const items = [
      ...studyState.notes.map(note => ({ type: `Note ${chapter.chapter}:${note.verse}`, text: note.note, at: note.updatedAt })),
      ...studyState.devotionals.map(note => ({ type: `Devotional ${note.devotionalDate || ''}`, text: note.notes || note.application || note.observation, at: note.updatedAt })),
      ...studyState.highlights.filter(mark => mark.note).map(mark => ({ type: `Highlight ${chapter.chapter}:${mark.verse}`, text: mark.note, at: mark.updatedAt })),
    ].sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))).slice(0, 5);
    feed.innerHTML = items.length ? items.map(item => `<article><strong>${esc(item.type)}</strong><p>${esc(String(item.text || '').slice(0, 180))}</p></article>`).join('') : '<article><strong>Quiet page</strong><p>No notes saved for this chapter yet.</p></article>';
  }

  function devotionalPrompt() {
    if (selectedVerse) return `Carry verse ${selectedVerse.number}: ${DEVOTIONAL_PROMPTS[dayIndex(DEVOTIONAL_PROMPTS.length)]}`;
    return DEVOTIONAL_PROMPTS[(dayIndex(DEVOTIONAL_PROMPTS.length) + currentChapter) % DEVOTIONAL_PROMPTS.length];
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
