// 52-week reading plan across the Tewahedo canon — OT track + NT track + wisdom track.

import { BIBLE_CANON } from './bible-canon.js';

const TRACKS = {
  ot: BIBLE_CANON.ot,
  nt: BIBLE_CANON.nt,
  wisdom: ['Psalms', 'Proverbs', 'Ecclesiastes', 'Job', 'Wisdom', 'Sirach', '1 Enoch'],
};

export const READING_PLAN = (() => {
  const weeks = [];
  for (let w = 0; w < 52; w++) {
    const ot  = TRACKS.ot[w % TRACKS.ot.length];
    const nt  = TRACKS.nt[w % TRACKS.nt.length];
    const wis = TRACKS.wisdom[w % TRACKS.wisdom.length];
    weeks.push({
      week: w + 1,
      passages: [
        `${ot} ${1 + Math.floor(w / 12)}-${4 + Math.floor(w / 12)}`,
        `${nt} 1-${1 + (w % 3)}`,
        `${wis} ${1 + (w % 20)}`,
      ],
    });
  }
  return weeks;
})();

export function currentReadingWeek() {
  const start = new Date(new Date().getFullYear(), 0, 1);
  const now   = new Date();
  const diff  = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000));
  return Math.min(diff, 51);
}
