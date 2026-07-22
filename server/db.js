// MySQL connection pool + idempotent schema bootstrap.
//
// SECURITY: multipleStatements is intentionally OFF — every query path through
// this module sends a single statement. ensureSchema() splits schema.sql into
// individual statements in JS and executes them one at a time on a connection
// taken out of the pool, so we don't widen the injection surface for /sync etc.

import mysql from 'mysql2/promise';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, '..', 'db', 'schema.sql');

export const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     Number(process.env.DB_PORT || 3306),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'miracle',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  // multipleStatements stays false — see SECURITY note above.
});

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * Auto-apply schema on startup. Idempotent — every CREATE uses IF NOT EXISTS.
 * schema.sql must NOT contain CREATE DATABASE / USE (commented out at the top
 * of the file) so it runs against whatever DB the pool connected to.
 */
export async function ensureSchema() {
  let sql;
  try {
    sql = await fs.readFile(SCHEMA_PATH, 'utf8');
  } catch (e) {
    console.warn('[ensureSchema] schema.sql not found at', SCHEMA_PATH, '-', e.message);
    return;
  }
  const statements = splitSqlStatements(sql);
  const conn = await pool.getConnection();
  try {
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
      } catch (err) {
        console.error('[ensureSchema] statement failed:', firstLine(stmt), '→', err.message);
        throw err;
      }
    }
    console.log(`[ensureSchema] applied ${statements.length} statement(s)`);
  } finally {
    conn.release();
  }
}

/**
 * Split a SQL file into individual statements. Strips line comments (`-- …`),
 * skips empty/whitespace-only statements. Safe for our schema (no string
 * literals contain `;`, no DELIMITER blocks). NOT a general-purpose SQL parser.
 */
function splitSqlStatements(sql) {
  return sql
    .split('\n')
    .map(line => line.replace(/--.*$/, ''))         // strip line comments
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

function firstLine(s) {
  return (s.split('\n')[0] || '').slice(0, 80);
}
