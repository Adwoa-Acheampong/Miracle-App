export function buildPlanPortions(book, durationDays) {
  const totalVerses = book.verseCounts.reduce((sum, count) => sum + count, 0);
  const days = Math.min(Math.max(1, Number(durationDays || 1)), totalVerses);
  const portions = [];
  let chapterIndex = 0;
  let verse = 1;
  let remaining = totalVerses;

  for (let day = 1; day <= days && remaining > 0; day += 1) {
    let quota = Math.ceil(remaining / (days - day + 1));
    while (quota > 0 && chapterIndex < book.verseCounts.length) {
      const chapterVerseCount = book.verseCounts[chapterIndex];
      const available = chapterVerseCount - verse + 1;
      const take = Math.min(quota, available);
      portions.push({ book: book.id, day, chapter: chapterIndex + 1, verseStart: verse, verseEnd: verse + take - 1, completedAt: null });
      quota -= take;
      remaining -= take;
      verse += take;
      if (verse > chapterVerseCount) {
        chapterIndex += 1;
        verse = 1;
      }
    }
  }

  return portions;
}

export function countCompletedPlanDays(plan) {
  const byDay = new Map();
  plan.portions.forEach(portion => {
    const day = Number(portion.day || 1);
    const items = byDay.get(day) || [];
    items.push(portion);
    byDay.set(day, items);
  });
  return [...byDay.values()].filter(items => items.every(item => item.completedAt)).length;
}

export function selectCurrentPlanPortion(plan, today) {
  if (!plan?.portions?.length) return null;
  const elapsed = Math.max(0, Math.floor((new Date(`${today}T00:00:00Z`) - new Date(`${plan.startedOn}T00:00:00Z`)) / 86400000));
  const durationDays = Number(plan.durationDays || Math.max(...plan.portions.map(item => Number(item.day || 1))));
  const availableDay = Math.min(durationDays, elapsed + 1);
  return plan.portions.find(item => !item.completedAt && Number(item.day || 1) <= availableDay)
    || plan.portions.find(item => !item.completedAt)
    || null;
}
