import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourceDir = path.resolve(process.argv[2] || '.tmp-bible-usfm');
const outputDir = path.resolve(process.argv[3] || 'public/game-preview/bible/web-c');

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const files = (await readdir(sourceDir)).filter(file => file.endsWith('.usfm')).sort(numericPrefix);
const books = [];

for (const file of files) {
  const source = await readFile(path.join(sourceDir, file), 'utf8');
  const id = capture(source, /^\\id\s+([^\s-]+)/m) || file.slice(3, 6);
  const name = capture(source, /^\\toc1\s+(.+)$/m) || capture(source, /^\\h\s+(.+)$/m) || id;
  const chapters = parseBook(source);
  const bookDir = path.join(outputDir, id);
  await mkdir(bookDir, { recursive: true });
  for (const chapter of chapters) {
    await writeFile(path.join(bookDir, `${String(chapter.number).padStart(3, '0')}.json`), `${JSON.stringify({
      translation: 'WEB-C',
      book: id,
      name,
      chapter: chapter.number,
      verses: chapter.verses,
    })}\n`);
  }
  books.push({ id, name, chapters: chapters.length, verseCounts: chapters.map(chapter => chapter.verses.length) });
}

const manifest = {
  translation: 'WEB-C',
  name: 'World English Bible Catholic Edition',
  language: 'English',
  publicDomain: true,
  source: 'https://ebible.org/eng-web-c/',
  generatedAt: new Date().toISOString(),
  books,
};
await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest)}\n`);
console.log(`Built ${books.length} books and ${books.reduce((sum, book) => sum + book.chapters, 0)} chapters in ${outputDir}`);

function parseBook(raw) {
  const cleaned = raw
    .replace(/\\f\s[\s\S]*?\\f\*/g, '')
    .replace(/\\x\s[\s\S]*?\\x\*/g, '')
    .replace(/\\fig\s[\s\S]*?\\fig\*/g, '')
    .replace(/\r/g, '');
  const chapters = [];
  let chapter = null;
  let verse = null;
  for (const rawLine of cleaned.split('\n')) {
    const line = rawLine.trim();
    const chapterMatch = line.match(/^\\c\s+(\d+)/);
    if (chapterMatch) {
      chapter = { number: Number(chapterMatch[1]), verses: [] };
      chapters.push(chapter);
      verse = null;
      continue;
    }
    const verseMatch = line.match(/^\\v\s+([\d-]+)\s*(.*)$/);
    if (verseMatch && chapter) {
      verse = { number: verseMatch[1], text: cleanText(verseMatch[2]) };
      chapter.verses.push(verse);
      continue;
    }
    if (!verse || !line || /^(\\id|\\h|\\toc|\\mt|\\ip|\\rem)/.test(line)) continue;
    const continuation = cleanText(line);
    if (continuation) verse.text = `${verse.text} ${continuation}`.trim();
  }
  return chapters.filter(item => item.verses.length);
}

function cleanText(value) {
  return String(value || '')
    .replace(/\\w\s+([^|\\]+)(?:\|[^\\]+)?\\w\*/g, '$1')
    .replace(/\\(?:add|bd|bdit|bk|dc|em|it|k|nd|ord|pn|qt|sc|sig|sls|tl|wj)\s*/g, '')
    .replace(/\\(?:add|bd|bdit|bk|dc|em|it|k|nd|ord|pn|qt|sc|sig|sls|tl|wj)\*/g, '')
    .replace(/\\[a-z0-9]+\*?\s*/gi, '')
    .replace(/\|[^\s]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function capture(value, pattern) {
  return value.match(pattern)?.[1]?.trim() || '';
}

function numericPrefix(a, b) {
  return Number.parseInt(a, 10) - Number.parseInt(b, 10) || a.localeCompare(b);
}
