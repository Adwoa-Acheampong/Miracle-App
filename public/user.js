// Single-user profile. Stored in IDB `meta` keyed by 'user'.
// Multi-user is intentionally NOT implemented — one person per browser by design.

import { get, put } from './store.js';

const KEY = 'user';

/**
 * Read the current user profile from IndexedDB.
 * @returns {Promise<{name: string, calling?: string, welcomed?: boolean, createdAt: string, updatedAt: string} | null>}
 */
export async function loadUser() {
  const row = await get('meta', KEY);
  return row?.value || null;
}

/**
 * Shallow-merge `patch` into the existing profile, updating timestamps.
 * Creates the row if it doesn't exist.
 * @param {object} patch — partial profile fields to merge
 * @returns {Promise<object>} the saved profile
 */
export async function saveUser(patch) {
  const existing = (await loadUser()) || {};
  const now = new Date().toISOString();
  const next = {
    ...existing,
    ...patch,
    updatedAt: now,
    createdAt: existing.createdAt || now,
  };
  await put('meta', { key: KEY, value: next });
  return next;
}

/** Clear the local profile (sets the meta row's value to null). */
export async function signOut() {
  await put('meta', { key: KEY, value: null });
}

/**
 * "Adwoa Acheampong" → "adwoa". Fallback "friend".
 * @param {{name?: string} | null | undefined} user
 * @returns {string}
 */
export function firstName(user) {
  return (user?.name || 'friend').split(' ')[0].toLowerCase();
}

/**
 * "Adwoa Acheampong" → "AA". Single-word → first two letters uppercase.
 * Empty input → "·".
 * @param {string | null | undefined} name
 * @returns {string} 1–2 char initials
 */
export function initials(name) {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
