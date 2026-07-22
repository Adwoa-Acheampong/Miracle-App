// IndexedDB façade — single write path, dispatches entry:changed events.

const DB_NAME    = 'hobonichi-adwoa';
const DB_VERSION = 10;

const STORES = {
  daily:        { keyPath: 'date' },
  dreams:       { keyPath: 'id', indexes: ['updatedAt', 'status'] },
  ideas:        { keyPath: 'id', indexes: ['updatedAt', 'status'] },
  bible:        { keyPath: 'id', indexes: ['updatedAt', 'passageBook'] },
  prayers:      { keyPath: 'id', indexes: ['updatedAt', 'status', 'answeredOn'] },
  prophecies:   { keyPath: 'id', indexes: ['updatedAt', 'status', 'dateReceived', 'fulfilledOn'] },
  fasts:        { keyPath: 'id', indexes: ['startedAt'] },
  plans:        { keyPath: 'id', indexes: ['updatedAt', 'venture'] },
  projects:     { keyPath: 'id', indexes: ['updatedAt', 'phase'] },
  tasks:        { keyPath: 'id', indexes: ['scheduledFor', 'priority', 'completedAt'] },
  events:       { keyPath: 'id', indexes: ['startAt'] },
  meals:        { keyPath: 'id', indexes: ['date'] },
  transactions: { keyPath: 'id', indexes: ['date', 'venture'] },
  budgets:      { keyPath: 'id', indexes: ['period'] },
  blogs:        { keyPath: 'id', indexes: ['updatedAt', 'status'] },
  voiceProfiles:{ keyPath: 'id', indexes: ['updatedAt', 'name', 'active'] },
  fti:          { keyPath: 'date', indexes: ['score'] },
  postMetrics:  { keyPath: 'id', indexes: ['blogId', 'capturedAt', 'platform'] },
  testimonies:  { keyPath: 'id', indexes: ['updatedAt', 'date', 'status'] },
  music:        { keyPath: 'id', indexes: ['updatedAt', 'date'] },
  people:       { keyPath: 'id', indexes: ['updatedAt', 'name', 'lastTouchedAt'] },
  books:        { keyPath: 'id', indexes: ['updatedAt', 'status', 'title'] },
  quizzes:      { keyPath: 'id', indexes: ['nextDueAt', 'status', 'sourceStore'] },
  bridgeInbox:  { keyPath: 'id', indexes: ['receivedAt', 'kind', 'applied'] },
  tags:         { keyPath: 'name' },
  mentions:     { keyPath: 'id', indexes: ['source', 'target'] },
  miracleLog:   { keyPath: 'id', indexes: ['at'] },
  goals:        { keyPath: 'id', indexes: ['updatedAt', 'period', 'status', 'domain'] },
  kpiTargets:   { keyPath: 'id', indexes: ['updatedAt', 'metric', 'domain', 'period'] },
  focusSessions:{ keyPath: 'id', indexes: ['startedAt', 'status', 'mode', 'taskId'] },
  feedback:     { keyPath: 'id', indexes: ['createdAt', 'kind', 'status'] },
  meta:         { keyPath: 'key' },
};

export const STORE_NAMES = Object.freeze(Object.keys(STORES));
const TRASH_RETENTION_DAYS = 30;

let db = null;

export function openStore() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const idb = req.result;
      const upgradeTx = req.transaction;
      for (const [name, spec] of Object.entries(STORES)) {
        const os = idb.objectStoreNames.contains(name)
          ? upgradeTx.objectStore(name)
          : idb.createObjectStore(name, { keyPath: spec.keyPath });
        for (const idx of spec.indexes || []) {
          if (!os.indexNames.contains(idx)) os.createIndex(idx, idx);
        }
      }
    };
    req.onsuccess = () => {
      db = req.result;
      purgeTrash().catch(() => {});
      resolve(db);
    };
    req.onerror   = () => reject(req.error);
  });
}

/**
 * Generate a ULID-flavored 18-char monotonic-ish id (timestamp prefix + random).
 * Not a real ULID — but lexicographically sortable by creation time, which is
 * what we need.
 * @returns {string}
 */
export function ulid() {
  const t = Date.now().toString(36).padStart(8, '0');
  const r = Math.random().toString(36).slice(2, 12).padStart(10, '0');
  return (t + r).toUpperCase();
}

/**
 * Upsert one row into a store. Stamps createdAt/updatedAt automatically.
 * Dispatches `entry:changed` on window so subscribers can re-render.
 * If offline, asks the SW to register a background sync.
 * @param {string} store  — store name from S in util/stores.js
 * @param {object} value  — full row; must contain the store's keyPath
 * @returns {Promise<object>} the stamped row that was written
 */
export function put(store, value) {
  const now = new Date().toISOString();
  const stamped = {
    ...value,
    updatedAt: now,
    createdAt: value.createdAt || now,
  };
  return tx(store, 'readwrite', os => os.put(stamped)).then(() => {
    emitEntryChanged({ store, value: stamped });
    if (typeof navigator !== 'undefined' && !navigator.onLine && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'queue-sync' });
    }
    return stamped;
  });
}

/** Get one row by primary key. Returns undefined if not found. */
export function get(store, key) { return tx(store, 'readonly', os => os.get(key)); }

/** Get every row in a store. Use sparingly — IDB has no streaming. */
export function all(store, options = {}) {
  return tx(store, 'readonly', os => os.getAll()).then(rows => {
    const includeDeleted = !!options.includeDeleted;
    const includeDrafts = !!options.includeDrafts;
    return rows.filter(row => {
      if (!includeDeleted && isDeleted(row)) return false;
      if (!includeDrafts && row?._draft) return false;
      return true;
    });
  });
}

/** Delete one row by primary key. Dispatches `entry:changed`. */
export async function del(store, key, options = {}) {
  if (options.hard) return hardDelete(store, key, options);
  const row = await get(store, key);
  if (!row) return undefined;
  const now = new Date();
  const purgeAt = new Date(now.getTime() + TRASH_RETENTION_DAYS * 86400000).toISOString();
  const trashed = {
    ...row,
    _draft: false,
    _deleted: true,
    deletedAt: now.toISOString(),
    deletedFrom: store,
    deletedReason: options.reason || 'user',
    purgeAt,
  };
  const value = await put(store, trashed);
  emitEntryChanged({ store, deleted: key, value });
  return value;
}

/** Restore one row from trash. */
export async function restore(store, key) {
  const row = await get(store, key);
  if (!row) return undefined;
  const restored = { ...row };
  delete restored._deleted;
  delete restored.deletedAt;
  delete restored.deletedFrom;
  delete restored.deletedReason;
  delete restored.purgeAt;
  delete restored._draft;
  delete restored._draftCreatedAt;
  return put(store, restored);
}

/** Permanently delete one row. Use for Trash purge/permanent delete only. */
export function hardDelete(store, key, options = {}) {
  return tx(store, 'readwrite', os => os.delete(key)).then(() => {
    if (!options.silent) emitEntryChanged({ store, hardDeleted: key });
  });
}

/** Wipe expired trash rows from every store. */
export async function purgeTrash() {
  if (!db) return 0;
  const now = new Date().toISOString();
  let removed = 0;
  for (const store of STORE_NAMES) {
    const rows = await all(store, { includeDeleted: true, includeDrafts: true }).catch(() => []);
    const expired = rows.filter(row => isDeleted(row) && (row.purgeAt || row.deletedAt || '') <= now);
    for (const row of expired) {
      const key = primaryKeyFor(store, row);
      if (key === undefined || key === null) continue;
      await hardDelete(store, key, { silent: true }).catch(() => {});
      removed++;
    }
  }
  if (removed) emitEntryChanged({ store: '*', purgedTrash: removed });
  return removed;
}

function tx(store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t   = db.transaction(store, mode);
    const os  = t.objectStore(store);
    const req = fn(os);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function isDeleted(row) {
  return !!(row && (row._deleted || row.deletedAt));
}

function primaryKeyFor(store, row) {
  const keyPath = STORES[store]?.keyPath;
  return keyPath ? row?.[keyPath] : undefined;
}

function emitEntryChanged(detail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('entry:changed', { detail }));
}
