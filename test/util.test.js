// Smoke tests for shared utilities. Run with `npm test` (from repo root) or
// `node --test test/util.test.js` directly. No deps required — uses Node's
// built-in test runner (Node ≥18).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { esc } from '../public/util/esc.js';
import { firstName, initials } from '../public/user.js';
// Avoid pulling user.js's IDB-touching helpers — only the pure functions above are tested.

// ─── esc() ────────────────────────────────────────────────────────
test('esc: escapes all five HTML-sensitive chars', () => {
  assert.equal(esc(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('esc: null/undefined/empty → empty string', () => {
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(''), '');
});

test('esc: numbers and booleans stringify cleanly', () => {
  assert.equal(esc(42), '42');
  assert.equal(esc(false), 'false');
});

test('esc: leaves safe chars alone', () => {
  assert.equal(esc('hello world 123'), 'hello world 123');
});

test('esc: attribute-context attack payloads neutralized', () => {
  // Quote escaping is what prevents attribute-context breakouts.
  const attack = `" onerror="alert(1)`;
  assert.ok(!esc(attack).includes('"'));
  assert.ok(esc(attack).includes('&quot;'));
});

// ─── firstName ────────────────────────────────────────────────────
test('firstName: full name → lowercase first token', () => {
  assert.equal(firstName({ name: 'Adwoa Acheampong' }), 'adwoa');
});

test('firstName: single name', () => {
  assert.equal(firstName({ name: 'Madonna' }), 'madonna');
});

test('firstName: missing user or name → "friend"', () => {
  assert.equal(firstName(null), 'friend');
  assert.equal(firstName(undefined), 'friend');
  assert.equal(firstName({}), 'friend');
  assert.equal(firstName({ name: '' }), 'friend');
});

// ─── initials ─────────────────────────────────────────────────────
test('initials: two-token name → first + last initial', () => {
  assert.equal(initials('Adwoa Acheampong'), 'AA');
  assert.equal(initials('jane doe'), 'JD');
});

test('initials: three-token name uses first + last (not middle)', () => {
  assert.equal(initials('Adwoa Nana Acheampong'), 'AA');
});

test('initials: single token → first two letters uppercase', () => {
  assert.equal(initials('Madonna'), 'MA');
});

test('initials: empty/null/undefined → "·"', () => {
  assert.equal(initials(''), '·');
  assert.equal(initials(null), '·');
  assert.equal(initials(undefined), '·');
});

test('initials: extra whitespace tolerated', () => {
  assert.equal(initials('  Adwoa   Acheampong  '), 'AA');
});
