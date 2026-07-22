// Verse rotation used across Miracle echoes, daily ribbon, and book view.

export const SCRIPTURE = [
  { ref: 'Matthew 22:37',  text: 'love the Lord your God with all your heart, soul, and mind.' },
  { ref: 'Matthew 22:39',  text: 'love your neighbor as yourself.' },
  { ref: 'Romans 8:28',    text: 'all things work together for good to them that love God.' },
  { ref: 'Proverbs 16:3',  text: 'commit your work to the Lord, and your plans will be established.' },
  { ref: 'Psalm 90:12',    text: 'teach us to number our days, that we may gain a heart of wisdom.' },
  { ref: 'Isaiah 26:3',    text: 'you will keep him in perfect peace, whose mind is stayed on you.' },
  { ref: 'James 1:5',      text: 'if any of you lacks wisdom, let him ask of God.' },
  { ref: 'Philippians 4:6',text: 'be anxious for nothing; in everything by prayer let your requests be made known.' },
  { ref: 'Jeremiah 29:11', text: 'I know the plans I have for you, plans for welfare, not for evil.' },
  { ref: 'Joshua 1:9',     text: 'be strong and of good courage; the Lord your God is with you.' },
  { ref: 'Psalm 37:4',     text: 'delight yourself in the Lord; he will give you the desires of your heart.' },
  { ref: 'Matthew 6:33',   text: 'seek first the kingdom of God and his righteousness.' },
  { ref: 'Proverbs 3:5-6', text: 'trust in the Lord with all your heart; lean not on your own understanding.' },
  { ref: '2 Timothy 1:7',  text: 'God has not given us a spirit of fear, but of power, of love, and of a sound mind.' },
  { ref: '1 Corinthians 16:13', text: 'watch, stand fast in the faith, be brave, be strong.' },
  { ref: 'Psalm 1:2-3',    text: 'his delight is in the law of the Lord; he is like a tree planted by streams of water.' },
  { ref: 'Ephesians 6:10', text: 'be strong in the Lord, and in the power of his might.' },
  { ref: 'Sirach 2:1',     text: 'my son, when you come to serve the Lord, prepare yourself for trial.' },
  { ref: 'Wisdom 7:7',     text: 'I prayed, and understanding was given me; I called, and the spirit of wisdom came to me.' },
  { ref: '1 Enoch 1:8',    text: 'with the righteous he will make peace, and will protect the elect.' },
  { ref: '1 Enoch 5:8',    text: 'to the elect there shall be light and joy and peace, and they shall inherit the earth.' },
  { ref: '2 Esdras 14:25', text: 'I will light a candle of understanding in your heart, which shall not be put out.' },
  { ref: 'Revelation 12:11', text: 'they overcame him by the blood of the Lamb and by the word of their testimony.' },
  { ref: 'Ephesians 5:19', text: 'speak to one another with psalms, hymns, and spiritual songs.' },
];

export function verseForSeed(seed) {
  return SCRIPTURE[Math.abs(seed) % SCRIPTURE.length];
}
export function verseForDate(d) {
  const seed = String(d).split('-').reduce((a, b) => a + Number(b || 0), 0);
  return verseForSeed(seed);
}
export function randomVerse() {
  return SCRIPTURE[Math.floor(Math.random() * SCRIPTURE.length)];
}
