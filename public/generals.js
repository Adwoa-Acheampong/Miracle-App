// Christian generals — encouragement card on dashboard. Cycles randomly.

export const GENERALS = [
  { id: 'jesus',      name: 'Jesus of Nazareth',  era: '1st c.',     initials: 'JC',
    quote: 'be of good cheer; I have overcome the world.', verseRef: 'John 16:33' },
  { id: 'abraham',    name: 'Abraham',            era: 'patriarch',  initials: 'AB',
    quote: 'the Lord will provide.',                       verseRef: 'Genesis 22:14' },
  { id: 'moses',      name: 'Moses',              era: 'exodus',     initials: 'MO',
    quote: 'the Lord will fight for you; you need only be still.', verseRef: 'Exodus 14:14' },
  { id: 'david',      name: 'King David',         era: 'psalmist',   initials: 'DA',
    quote: 'the Lord is my shepherd; I shall not want.',   verseRef: 'Psalm 23:1' },
  { id: 'solomon',    name: 'King Solomon',       era: 'wisdom',     initials: 'SO',
    quote: 'commit your work to the Lord, and your plans will be established.', verseRef: 'Proverbs 16:3' },
  { id: 'paul',       name: 'Apostle Paul',       era: '1st c.',     initials: 'PA',
    quote: 'I can do all things through Christ who strengthens me.', verseRef: 'Philippians 4:13' },
  { id: 'peter',      name: 'Apostle Peter',      era: '1st c.',     initials: 'PE',
    quote: 'humble yourselves under the mighty hand of God; he will lift you up.', verseRef: '1 Peter 5:6' },
  { id: 'enoch',      name: 'Enoch',              era: 'antediluvian', initials: 'EN',
    quote: 'he walked with God, and was not, for God took him.',     verseRef: 'Genesis 5:24' },
  { id: 'oral',       name: 'Oral Roberts',       era: '1918-2009',  initials: 'OR',
    quote: 'expect a miracle. something good is going to happen to you.', verseRef: 'Mark 11:24' },
  { id: 'spurgeon',   name: 'Charles Spurgeon',   era: '1834-1892',  initials: 'CS',
    quote: 'I have learned to kiss the wave that throws me against the Rock of Ages.', verseRef: 'Isaiah 26:4' },
  { id: 'wigglesworth', name: 'Smith Wigglesworth', era: '1859-1947', initials: 'SW',
    quote: 'great faith is the product of great fights. great testimonies are the outcome of great tests.', verseRef: 'James 1:3' },
  { id: 'tozer',      name: 'A.W. Tozer',         era: '1897-1963',  initials: 'AT',
    quote: 'what comes into our minds when we think about God is the most important thing about us.', verseRef: 'Psalm 46:10' },
  { id: 'chambers',   name: 'Oswald Chambers',    era: '1874-1917',  initials: 'OC',
    quote: 'the great enemy of the life of faith in God is not sin, but the good which is not good enough.', verseRef: 'Hebrews 11:1' },
  { id: 'bonhoeffer', name: 'Dietrich Bonhoeffer',era: '1906-1945',  initials: 'DB',
    quote: 'when Christ calls a man, he bids him come and die.', verseRef: 'Matthew 16:24' },
];

export function generalForDate(d) {
  const seed = String(d).split('-').reduce((a, b) => a + Number(b || 0), 0);
  return GENERALS[seed % GENERALS.length];
}
export function randomGeneral() {
  return GENERALS[Math.floor(Math.random() * GENERALS.length)];
}
