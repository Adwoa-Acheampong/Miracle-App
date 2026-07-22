// In-memory inverted index. Built lazily on first search, refreshed on entry:changed.

import { all } from './store.js';

const FIELDS = {
  ideas:        ['title','body','tags'],
  tasks:        ['title'],
  projects:     ['title','body'],
  plans:        ['title','thesis','venture'],
  events:       ['title','location','prepNotes','debriefNotes','attendees'],
  bible:        ['passage','observation','interpretation','application','notes','prayer'],
  prayers:      ['subject','answerNote'],
  fasts:        ['purpose','reflection'],
  dreams:       ['title','body','symbols'],
  meals:        ['actualItems','plannedItems'],
  transactions: ['payee','memo','category','venture'],
  books:        ['title','author','summary','keyIdeas','themes','notes'],
  blogs:        ['title','hook','longForm','seedText','topics'],
  quizzes:      ['question','answer','sourceLabel'],
};

let index = null;

export async function buildIndex() {
  const idx = [];
  for (const [store, fields] of Object.entries(FIELDS)) {
    let rows;
    try { rows = await all(store); } catch { continue; }
    for (const row of rows) {
      const text = fields.map(f => {
        const v = row[f];
        if (Array.isArray(v)) return v.join(' ');
        return String(v ?? '');
      }).join(' \n ').toLowerCase();
      if (!text.trim()) continue;
      idx.push({
        store,
        id: row.id || row.date,
        title: row.title || row.subject || row.passage || row.payee || row.purpose || row.date || row.id,
        text,
        updatedAt: row.updatedAt,
      });
    }
  }
  index = idx;

  // Refresh on changes
  if (!buildIndex._wired) {
    window.addEventListener('entry:changed', () => { index = null; });
    buildIndex._wired = true;
  }

  return idx.length;
}

export async function search(query) {
  if (!index) await buildIndex();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const scored = [];
  for (const entry of index) {
    let score = 0, allMatch = true;
    for (const t of terms) {
      const re = new RegExp(escRx(t), 'g');
      const matches = (entry.text.match(re) || []).length;
      if (!matches) { allMatch = false; break; }
      score += matches;
      if (String(entry.title || '').toLowerCase().includes(t)) score += 5;
    }
    if (allMatch && score > 0) scored.push({ ...entry, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 60);
}

function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
