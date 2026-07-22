// One-off audit + cleanup script. Run via: railway run node scripts/db-audit.mjs [--purge]
import mysql from 'mysql2/promise';

const PURGE = process.argv.includes('--purge');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 4,
});

try {
  const [tables] = await pool.query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?',
    [process.env.DB_NAME]
  );
  console.log(`TABLES: ${tables.length}`);

  // Tables we want to keep schema for but never wipe (none for now — full wipe).
  const KEEP = new Set([]); // empty = nuke everything

  let total = 0;
  const nonEmpty = [];
  for (const t of tables) {
    const name = t.TABLE_NAME;
    const [r] = await pool.query(`SELECT COUNT(*) AS c FROM \`${name}\``);
    const c = Number(r[0].c);
    if (c > 0) {
      console.log(name.padEnd(30), c);
      nonEmpty.push(name);
    }
    total += c;
  }
  console.log(`TOTAL ROWS: ${total}`);

  if (PURGE) {
    console.log('\n--purge requested — truncating tables...');
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const t of tables) {
      if (KEEP.has(t.TABLE_NAME)) continue;
      await pool.query(`TRUNCATE TABLE \`${t.TABLE_NAME}\``);
      console.log('truncated', t.TABLE_NAME);
    }
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('done.');
  } else {
    console.log('\n(dry run — add --purge to wipe)');
  }
} catch (e) {
  console.error('FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
