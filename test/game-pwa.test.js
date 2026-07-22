import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

test('installed game reveals a newer available build', async () => {
  const updateBanner = { hidden: true };
  const stored = new Map();
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  const originalLocalStorage = globalThis.localStorage;

  globalThis.document = {
    querySelector: () => ({ content: 'build-current' }),
    getElementById: id => id === 'game-update' ? updateBanner : null,
  };
  globalThis.localStorage = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, String(value)),
    removeItem: key => stored.delete(key),
  };
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ build: 'build-next' }),
  });

  try {
    const url = pathToFileURL(path.resolve('public/game-preview/pwa.js'));
    url.searchParams.set('test', String(Date.now()));
    const { checkGameBuild } = await import(url.href);
    assert.equal(await checkGameBuild(), true);
    assert.equal(updateBanner.hidden, false);
    assert.equal(stored.get('miracle_game_update_pending'), 'build-next');
  } finally {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
    globalThis.localStorage = originalLocalStorage;
  }
});
