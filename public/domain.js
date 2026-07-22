// Domain enums + small pure helpers. Imported wherever schemas are referenced.

export const VENTURES = [
  'SME Hub', 'Real Estate Hub', 'TyT-KoKus', 'Crushed Diamond',
  'Havilah', 'AGL', 'JonMon', 'Personal', 'Other',
];

export const PLAN_PHASES    = ['concept', 'validation', 'build', 'launch', 'scale', 'sunset'];
export const PROJECT_PHASES = ['brief', 'build', 'test', 'ship', 'maintain'];
export const EVENT_TYPES    = ['meeting', 'deep-work', 'personal', 'travel', 'church', 'family', 'client', 'standup'];
export const TASK_CONTEXTS  = ['deep', 'shallow', 'admin', 'errand', 'call', 'read', 'write'];
export const TASK_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

export const PRAYER_TYPES = ['intercession', 'supplication', 'thanksgiving', 'confession', 'warfare'];
export const PRAYER_ANSWERS = ['pending', 'yes', 'no', 'redirect'];
export const FAST_TYPES = ['water', 'food', 'partial', 'dawn-dusk', 'media', 'sexual', 'combo'];

export const PROPHECY_PLATFORMS = ['church', 'sermon', 'dream', 'vision', 'prayer-line', 'conference', 'mentor', 'DM', 'book', 'inner-witness', 'other'];
export const PROPHECY_STATUSES  = ['active', 'fulfilled', 'partially-fulfilled', 'cancelled', 'archived'];
export const TX_ACCOUNTS = ['Cash', 'MoMo', 'Bank-GCB', 'Bank-Stanbic', 'Bank-Ecobank', 'Card', 'Other'];
export const TX_CATEGORIES = ['food', 'transport', 'fuel', 'rent', 'utilities', 'subscriptions', 'health', 'family', 'salary', 'inventory', 'capex', 'tithe', 'giving', 'misc'];

export const BLOG_PLATFORMS    = ['blog', 'linkedin', 'x', 'instagram', 'facebook', 'threads', 'newsletter'];
export const BLOG_STATUSES     = ['seeding', 'drafting', 'review', 'approved', 'published', 'withdrawn', 'archived'];
export const VARIANT_STATUSES  = ['draft', 'approved', 'queued', 'published', 'failed', 'withdrawn'];

export const PLATFORM_LIMITS = {
  blog:       { chars: 25000, hashtags: 10 },
  linkedin:   { chars: 3000,  hashtags: 5  },
  x:          { chars: 280,   hashtags: 3, threadOk: true },
  instagram:  { chars: 2200,  hashtags: 30 },
  facebook:   { chars: 5000,  hashtags: 10 },
  threads:    { chars: 500,   hashtags: 5  },
  newsletter: { chars: 12000, hashtags: 0  },
};

export const BOOK_FORMATS  = ['book', 'audiobook', 'paper', 'pdf', 'sermon', 'lecture', 'article', 'other'];
export const BOOK_STATUSES = ['wishlist', 'reading', 'paused', 'finished'];
export const QUIZ_TYPES    = ['mc', 'short', 'tf'];
export const SR_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 120, 240];

export const BIBLE_BOOKS = [
  // OT (39)
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy',
  'Joshua','Judges','Ruth','1 Samuel','2 Samuel',
  '1 Kings','2 Kings','1 Chronicles','2 Chronicles','Ezra',
  'Nehemiah','Esther','Job','Psalms','Proverbs',
  'Ecclesiastes','Song of Solomon','Isaiah','Jeremiah','Lamentations',
  'Ezekiel','Daniel','Hosea','Joel','Amos',
  'Obadiah','Jonah','Micah','Nahum','Habakkuk',
  'Zephaniah','Haggai','Zechariah','Malachi',
  // NT (27)
  'Matthew','Mark','Luke','John','Acts',
  'Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians',
  'Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy',
  '2 Timothy','Titus','Philemon','Hebrews','James',
  '1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
];

export function fuzzyMatch(haystack, needle) {
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return norm(haystack).includes(norm(needle));
}

export function shortId(id) { return String(id || '').slice(-6); }

export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay() || 7;
  if (day !== 1) x.setDate(x.getDate() - (day - 1));
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function ymd(d) { return new Date(d).toISOString().slice(0, 10); }

export function shortDate(d) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase();
}

export function formatAgo(iso) {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
