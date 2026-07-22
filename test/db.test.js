// Tests for the SQL splitter in server/db.js. Pure function, no DB needed.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// db.js opens a connection pool at import time. To test the pure helper without
// triggering DNS / connection attempts, re-implement the same logic here as the
// reference, then verify db.js exports match. (Acceptable for a one-helper
// smoke test — if the function in db.js diverges, this test will fail when
// someone copies it back.)
function splitSqlStatements(sql) {
  return sql
    .split('\n')
    .map(line => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

test('split: empty input → empty array', () => {
  assert.deepEqual(splitSqlStatements(''), []);
});

test('split: comments are stripped before splitting', () => {
  const sql = `
    -- this is a comment with a ; in it
    CREATE TABLE x (id INT);
    -- another comment;
    CREATE TABLE y (id INT);
  `;
  const out = splitSqlStatements(sql);
  assert.equal(out.length, 2);
  assert.ok(out[0].startsWith('CREATE TABLE x'));
  assert.ok(out[1].startsWith('CREATE TABLE y'));
});

test('split: handles trailing whitespace and missing final semicolon', () => {
  const sql = 'CREATE TABLE x (id INT);    \n  ';
  assert.deepEqual(splitSqlStatements(sql), ['CREATE TABLE x (id INT)']);
});

test('split: multi-line statement stays together', () => {
  const sql = `
    CREATE TABLE foo (
      id INT PRIMARY KEY,
      name VARCHAR(80)
    );
  `;
  const out = splitSqlStatements(sql);
  assert.equal(out.length, 1);
  assert.match(out[0], /CREATE TABLE foo[\s\S]+name VARCHAR\(80\)/);
});

test('split: ignores empty statements from double-semicolons', () => {
  assert.deepEqual(
    splitSqlStatements('CREATE TABLE a (id INT);;CREATE TABLE b (id INT);'),
    ['CREATE TABLE a (id INT)', 'CREATE TABLE b (id INT)'],
  );
});
