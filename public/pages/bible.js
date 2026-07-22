import { all } from '../store.js';
import { BIBLE_CANON } from '../bible-canon.js';
import { CHAPTERS, parseChapter } from '../bible-chapters.js';
import { openDrawer } from '../drawer.js';
import {
  bindDrawerRows,
  renderEntryList,
  renderPageShell,
  reloadOnDrawerClose,
} from '../page-system.js';
import { esc } from '../util/esc.js';

export async function render() {
  const studies = (await all('bible')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const model = buildBibleProgress(studies);

  const root = document.createElement('div');
  root.className = 'page page-wide';
  root.innerHTML = renderPageShell({
    title: 'Bible',
    kicker: 'Faith lane',
    description: 'See scripture cadence, today\'s study, chapter coverage, and recent notes without hunting.',
    iconName: 'book-open',
    stats: [
      { label: 'studies', value: studies.length },
      { label: 'chapters', value: `${model.chaptersDone}/${model.totalChapters}` },
      { label: 'cadence', value: `${model.last14}/14` },
    ],
    body: `
      <section class="bible-overview">
        ${renderProgressPanel(model)}
        ${renderTodayCard(studies)}
      </section>

      ${renderCanonSection('Old Testament', 'protocanon - 39 books', BIBLE_CANON.ot, model, 'ot')}
      ${renderCanonSection('New Testament', '27 books', BIBLE_CANON.nt, model, 'nt')}
      ${renderCanonSection('Deuterocanon', 'catholic and orthodox books', BIBLE_CANON.deutero, model, 'deutero')}
      ${renderCanonSection('Tewahedo', 'ethiopian orthodox extras', BIBLE_CANON.tewahedo, model, 'tewahedo')}
      ${renderCanonSection('Referenced Apocrypha', 'study references', BIBLE_CANON.pseudepigrapha, model, 'pseudo')}

      <section class="sys-section">
        <div class="section-head">
          <span>Recent studies</span>
          <small>${studies.length}</small>
        </div>
        ${renderEntryList({
          items: studies.slice(0, 50),
          store: 'bible',
          title: study => study.passage || study.passageBook || 'untitled passage',
          meta: study => [study.translation, (study.observation || study.notes || '').slice(0, 74)].filter(Boolean).join(' - '),
          empty: {
            title: 'No studies logged yet',
            hint: 'Add a passage, observation, interpretation, and application.',
            iconName: 'book-open',
          },
        })}
      </section>
    `,
  });

  root.querySelectorAll('.bible-cell.has').forEach(cell => {
    cell.addEventListener('click', () => {
      const study = studies.find(item => {
        const book = item.passageBook || tryBookFromPassage(item.passage);
        return book === cell.dataset.book;
      });
      if (study) openDrawer('bible', study.id);
    });
  });
  bindDrawerRows(root);
  reloadOnDrawerClose(root);
  return root;
}

function buildBibleProgress(studies) {
  const byBook = {};
  const chaptersTouched = {};

  for (const study of studies) {
    const book = study.passageBook || tryBookFromPassage(study.passage);
    if (!book) continue;
    byBook[book] = (byBook[book] || 0) + 1;
    const chapter = study.passageChapter || parseChapter(study.passage);
    if (chapter && CHAPTERS[book]) {
      chaptersTouched[book] = chaptersTouched[book] || new Set();
      chaptersTouched[book].add(chapter);
    }
  }

  const progress = {};
  for (const book of Object.keys(CHAPTERS)) {
    const total = CHAPTERS[book] || 0;
    const done = chaptersTouched[book] ? chaptersTouched[book].size : 0;
    progress[book] = total ? Math.min(1, done / total) : 0;
  }

  const protocanon = [...BIBLE_CANON.ot, ...BIBLE_CANON.nt];
  const totalChapters = protocanon.reduce((sum, book) => sum + (CHAPTERS[book] || 0), 0);
  const chaptersDone = protocanon.reduce((sum, book) => sum + (chaptersTouched[book]?.size || 0), 0);
  const overallPct = totalChapters ? Math.round((chaptersDone / totalChapters) * 100) : 0;

  return {
    byBook,
    chaptersTouched,
    progress,
    totalChapters,
    chaptersDone,
    overallPct,
    last14: streak(studies, 14),
  };
}

function renderProgressPanel(model) {
  return `
    <article class="bible-progress-panel">
      <span class="sys-kicker">protocanon progress</span>
      <strong>${model.overallPct}%</strong>
      <div class="bible-progress-bar">
        <span class="bible-progress-fill" style="width:${model.overallPct}%"></span>
      </div>
      <small>${model.chaptersDone} of ${model.totalChapters} chapters touched</small>
    </article>
  `;
}

function renderCanonSection(title, subtitle, books, model, klass) {
  const totalChapters = books.reduce((sum, book) => sum + (CHAPTERS[book] || 0), 0);
  const doneChapters = books.reduce((sum, book) => sum + (model.chaptersTouched[book]?.size || 0), 0);
  const pct = totalChapters ? Math.round((doneChapters / totalChapters) * 100) : 0;

  return `
    <section class="sys-section bible-canon-section">
      <div class="section-head">
        <span>${esc(title)}</span>
        <small>${esc(subtitle)} - ${doneChapters}/${totalChapters} ch - ${pct}%</small>
      </div>
      <div class="bible-grid">
        ${books.map(book => renderBookCell(book, model, klass)).join('')}
      </div>
    </section>
  `;
}

function renderBookCell(book, model, klass) {
  const count = model.byBook[book] || 0;
  const progress = model.progress[book] || 0;
  const done = model.chaptersTouched[book]?.size || 0;
  const total = CHAPTERS[book] || 0;
  const complete = progress >= 1 ? 'is-complete' : '';

  return `
    <button
      class="bible-cell ${klass} ${count ? 'has' : ''} ${complete}"
      style="--p:${progress.toFixed(3)}"
      data-book="${esc(book)}"
      title="${esc(`${book} - ${done}/${total} chapters - ${Math.round(progress * 100)}% - ${count} studies`)}"
      type="button">
      <span class="bible-cell-fill" style="height:${(progress * 100).toFixed(1)}%"></span>
      <span class="bible-abbr">${esc(abbr(book))}</span>
      ${count ? `<span class="bible-count">${done}/${total}</span>` : ''}
    </button>
  `;
}

function renderTodayCard(studies) {
  const today = new Date().toISOString().slice(0, 10);
  const todays = studies.filter(study => (study.updatedAt || '').slice(0, 10) === today || (study.createdAt || '').slice(0, 10) === today);
  const labelDate = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase();

  if (!todays.length) {
    return `
      <article class="bible-today-card is-empty">
        <div class="bible-today-head">
          <span class="sys-kicker">today's study</span>
          <span>${esc(labelDate)}</span>
        </div>
        <strong>No scripture logged yet today</strong>
        <p>Add one passage and the page becomes your daily refresher.</p>
      </article>
    `;
  }

  const latest = todays[0];
  const notes = [latest.observation, latest.interpretation, latest.application, latest.notes]
    .filter(Boolean)
    .join(' - ');

  return `
    <article class="bible-today-card">
      <div class="bible-today-head">
        <span class="sys-kicker">today's study</span>
        <span>${esc(labelDate)}</span>
      </div>
      <strong>${esc(latest.passage || latest.passageBook || 'Scripture')}</strong>
      ${latest.body ? `<blockquote class="classic-italic">${esc(latest.body)}</blockquote>` : ''}
      ${notes ? `<p>${esc(notes.slice(0, 260))}${notes.length > 260 ? '...' : ''}</p>` : ''}
      ${todays.length > 1 ? `<small>+ ${todays.length - 1} more today</small>` : ''}
    </article>
  `;
}

function abbr(book) {
  const map = {
    Genesis: 'Gen', Exodus: 'Exo', Leviticus: 'Lev', Numbers: 'Num', Deuteronomy: 'Deu',
    Joshua: 'Jos', Judges: 'Jdg', Ruth: 'Rth', '1 Samuel': '1Sa', '2 Samuel': '2Sa',
    '1 Kings': '1Ki', '2 Kings': '2Ki', '1 Chronicles': '1Ch', '2 Chronicles': '2Ch', Ezra: 'Ezr',
    Nehemiah: 'Neh', Esther: 'Est', Job: 'Job', Psalms: 'Psa', Proverbs: 'Prv',
    Ecclesiastes: 'Ecc', 'Song of Solomon': 'Sng', Isaiah: 'Isa', Jeremiah: 'Jer', Lamentations: 'Lam',
    Ezekiel: 'Eze', Daniel: 'Dan', Hosea: 'Hos', Joel: 'Joe', Amos: 'Amo',
    Obadiah: 'Oba', Jonah: 'Jon', Micah: 'Mic', Nahum: 'Nah', Habakkuk: 'Hab',
    Zephaniah: 'Zep', Haggai: 'Hag', Zechariah: 'Zec', Malachi: 'Mal',
    Matthew: 'Mat', Mark: 'Mrk', Luke: 'Luk', John: 'Jhn', Acts: 'Act',
    Romans: 'Rom', '1 Corinthians': '1Co', '2 Corinthians': '2Co', Galatians: 'Gal', Ephesians: 'Eph',
    Philippians: 'Php', Colossians: 'Col', '1 Thessalonians': '1Th', '2 Thessalonians': '2Th', '1 Timothy': '1Ti',
    '2 Timothy': '2Ti', Titus: 'Tit', Philemon: 'Phm', Hebrews: 'Heb', James: 'Jas',
    '1 Peter': '1Pe', '2 Peter': '2Pe', '1 John': '1Jn', '2 John': '2Jn', '3 John': '3Jn', Jude: 'Jud', Revelation: 'Rev',
    Tobit: 'Tob', Judith: 'Jdt', Wisdom: 'Wis', Sirach: 'Sir', Baruch: 'Bar',
    '1 Maccabees': '1Mc', '2 Maccabees': '2Mc', 'Additions to Esther': 'AEs',
    'Prayer of Azariah': 'PrA', Susanna: 'Sus', 'Bel and the Dragon': 'BeD',
    '1 Enoch': '1En', Jubilees: 'Jub', '1 Meqabyan': '1Mq', '2 Meqabyan': '2Mq', '3 Meqabyan': '3Mq',
    '1 Esdras': '1Es', '2 Esdras': '2Es', 'Prayer of Manasseh': 'PrM',
    'Joseph ben Gurion': 'JbG', Sinodos: 'Sin', Didascalia: 'Did',
    'Book of Jasher': 'Jsh', 'Book of the Wars of the Lord': 'BWL',
    'Gospel of Thomas': 'GTh', 'Apocalypse of Peter': 'ApP', 'Shepherd of Hermas': 'ShH',
    Didache: 'Ddc', 'Epistle of Barnabas': 'EBn', '2 Enoch': '2En', '3 Enoch': '3En',
  };
  return map[book] || book.slice(0, 3);
}

function streak(studies, days) {
  const dates = new Set(studies.map(study => (study.updatedAt || '').slice(0, 10)));
  let count = 0;
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    if (dates.has(date.toISOString().slice(0, 10))) count++;
  }
  return count;
}

function tryBookFromPassage(passage) {
  if (!passage) return null;
  const match = passage.match(/^\s*((?:\d\s)?[A-Za-z][A-Za-z\s]+?)\s+\d/);
  if (!match) return null;
  const candidate = match[1].trim();
  for (const book of Object.keys(CHAPTERS)) {
    if (book === candidate) return book;
    if (book.toLowerCase() === candidate.toLowerCase()) return book;
  }
  return null;
}
