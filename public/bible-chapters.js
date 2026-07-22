// Chapter counts per book across the full canon used by Miracle.
// Used to compute reading progress (chapters studied / total chapters).

export const CHAPTERS = {
  // ─── Old Testament · Protocanon (39) ──────────────────────────
  'Genesis': 50, 'Exodus': 40, 'Leviticus': 27, 'Numbers': 36, 'Deuteronomy': 34,
  'Joshua': 24, 'Judges': 21, 'Ruth': 4, '1 Samuel': 31, '2 Samuel': 24,
  '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36, 'Ezra': 10,
  'Nehemiah': 13, 'Esther': 10, 'Job': 42, 'Psalms': 150, 'Proverbs': 31,
  'Ecclesiastes': 12, 'Song of Solomon': 8, 'Isaiah': 66, 'Jeremiah': 52, 'Lamentations': 5,
  'Ezekiel': 48, 'Daniel': 12, 'Hosea': 14, 'Joel': 3, 'Amos': 9,
  'Obadiah': 1, 'Jonah': 4, 'Micah': 7, 'Nahum': 3, 'Habakkuk': 3,
  'Zephaniah': 3, 'Haggai': 2, 'Zechariah': 14, 'Malachi': 4,

  // ─── New Testament (27) ───────────────────────────────────────
  'Matthew': 28, 'Mark': 16, 'Luke': 24, 'John': 21, 'Acts': 28,
  'Romans': 16, '1 Corinthians': 16, '2 Corinthians': 13, 'Galatians': 6, 'Ephesians': 6,
  'Philippians': 4, 'Colossians': 4, '1 Thessalonians': 5, '2 Thessalonians': 3,
  '1 Timothy': 6, '2 Timothy': 4, 'Titus': 3, 'Philemon': 1,
  'Hebrews': 13, 'James': 5, '1 Peter': 5, '2 Peter': 3,
  '1 John': 5, '2 John': 1, '3 John': 1, 'Jude': 1, 'Revelation': 22,

  // ─── Deuterocanon (11) ────────────────────────────────────────
  'Tobit': 14, 'Judith': 16, 'Wisdom': 19, 'Sirach': 51, 'Baruch': 6,
  '1 Maccabees': 16, '2 Maccabees': 15,
  'Additions to Esther': 6, 'Prayer of Azariah': 1, 'Susanna': 1, 'Bel and the Dragon': 1,

  // ─── Tewahedo extras (11) ─────────────────────────────────────
  '1 Enoch': 108, 'Jubilees': 50,
  '1 Meqabyan': 36, '2 Meqabyan': 21, '3 Meqabyan': 10,
  '1 Esdras': 9, '2 Esdras': 16, 'Prayer of Manasseh': 1,
  'Joseph ben Gurion': 6, 'Sinodos': 4, 'Didascalia': 8,

  // ─── Pseudepigrapha (referenced) ──────────────────────────────
  'Book of Jasher': 91, 'Book of the Wars of the Lord': 1,
  'Gospel of Thomas': 1, 'Apocalypse of Peter': 1, 'Shepherd of Hermas': 5,
  'Didache': 16, 'Epistle of Barnabas': 21, '2 Enoch': 73, '3 Enoch': 48,
};

// Try to parse the chapter number out of a passage string like
// "Romans 8:28" or "Genesis 1:1-31" or "2 Tim 1:7-12".
// Returns null if not parseable.
export function parseChapter(passage) {
  if (!passage) return null;
  // Look for "<word(s)> <chapter>(:?)"
  const m = passage.match(/^\s*((?:\d\s)?[A-Za-z][A-Za-z\s]*?)\s+(\d+)(?::|\s|$)/);
  if (!m) return null;
  return Number(m[2]);
}

// Total chapters in the canon section (for footer summaries).
export function totalChaptersOf(books) {
  return books.reduce((s, b) => s + (CHAPTERS[b] || 0), 0);
}
