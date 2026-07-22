// Tewahedo / Ethiopian Orthodox-aware canon. Protocanon 66 + deuterocanon + Tewahedo extras.

export const BIBLE_CANON = {
  ot: [
    'Genesis','Exodus','Leviticus','Numbers','Deuteronomy',
    'Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings',
    '1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther',
    'Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon',
    'Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel',
    'Hosea','Joel','Amos','Obadiah','Jonah','Micah',
    'Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
  ],
  nt: [
    'Matthew','Mark','Luke','John','Acts',
    'Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians',
    'Philippians','Colossians','1 Thessalonians','2 Thessalonians',
    '1 Timothy','2 Timothy','Titus','Philemon',
    'Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John',
    'Jude','Revelation',
  ],
  deutero: [
    'Tobit','Judith','Wisdom','Sirach','Baruch','1 Maccabees','2 Maccabees',
    'Additions to Esther','Prayer of Azariah','Susanna','Bel and the Dragon',
  ],
  tewahedo: [
    '1 Enoch','Jubilees','1 Meqabyan','2 Meqabyan','3 Meqabyan',
    '1 Esdras','2 Esdras','Prayer of Manasseh',
    'Joseph ben Gurion','Sinodos','Didascalia',
  ],
  pseudepigrapha: [
    'Book of Jasher','Book of the Wars of the Lord',
    'Gospel of Thomas','Apocalypse of Peter','Shepherd of Hermas',
    'Didache','Epistle of Barnabas','2 Enoch','3 Enoch',
  ],
};

export const ALL_BOOKS = [
  ...BIBLE_CANON.ot,
  ...BIBLE_CANON.nt,
  ...BIBLE_CANON.deutero,
  ...BIBLE_CANON.tewahedo,
];
