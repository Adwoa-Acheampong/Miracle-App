// lock.js — privacy gate for sensitive entries.
// PIN is hashed with SHA-256 and stored on the user profile. Unlock state
// lives in sessionStorage so closing the tab/browser re-locks immediately.

import { loadUser, saveUser } from './user.js';
import { requestPinResetOtp, verifyPinResetOtp, isAuthed, getCachedUser } from './auth.js';

import { esc } from './util/esc.js';
const SESSION_KEY = 'miracle_vault_unlocked';
const PIN_LEN_MIN = 4;
const PIN_LEN_MAX = 12;

// ── hashing ─────────────────────────────────────────────────

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── PIN management ──────────────────────────────────────────

export async function hasPin() {
  const u = await loadUser();
  return !!(u && u.pinHash);
}

export async function setPin(pin) {
  if (!validPin(pin)) throw new Error(`PIN must be ${PIN_LEN_MIN}–${PIN_LEN_MAX} digits`);
  const u = (await loadUser()) || {};
  u.pinHash = await sha256(pin);
  u.pinSetAt = new Date().toISOString();
  await saveUser(u);
  sessionStorage.setItem(SESSION_KEY, '1');
}

export async function changePin(oldPin, newPin) {
  const ok = await verifyPin(oldPin);
  if (!ok) throw new Error('current PIN is wrong');
  await setPin(newPin);
}

export async function clearPin(currentPin) {
  const ok = await verifyPin(currentPin);
  if (!ok) throw new Error('PIN is wrong');
  const u = (await loadUser()) || {};
  delete u.pinHash;
  delete u.pinSetAt;
  await saveUser(u);
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * "I forgot my PIN" recovery.
 * Wipes the PIN hash and removes the `locked` flag from every entry across
 * every store. Entries are NOT deleted — they just stop being hidden.
 *
 * Rationale: the lock is obfuscation, not encryption. Data sits in plain
 * IndexedDB. Destroying entries because someone forgot a 4-digit code
 * would be the wrong trade-off for a personal journal.
 *
 * Returns { unlockedCount } so the UI can confirm what happened.
 */
export async function forgotPin() {
  // 1. Strip PIN from user profile
  const u = (await loadUser()) || {};
  delete u.pinHash;
  delete u.pinSetAt;
  await saveUser(u);
  sessionStorage.removeItem(SESSION_KEY);

  // 2. Sweep every store and clear `locked` on each entry
  const { all, put } = await import('./store.js');
  const STORES = [
    'daily','dreams','ideas','bible','prayers','fasts','plans','projects',
    'tasks','events','meals','transactions','blogs','testimonies','music',
    'people','books','quizzes','voiceProfiles',
  ];
  let unlockedCount = 0;
  for (const s of STORES) {
    let rows; try { rows = await all(s); } catch { continue; }
    for (const r of rows) {
      if (r.locked) {
        try {
          await put(s, { ...r, locked: false, lockedAt: null });
          unlockedCount++;
        } catch { /* skip on per-row failure */ }
      }
    }
  }

  window.dispatchEvent(new CustomEvent('vault:reset', { detail: { unlockedCount } }));
  return { unlockedCount };
}

export async function verifyPin(pin) {
  const u = await loadUser();
  if (!u || !u.pinHash) return false;
  return (await sha256(pin)) === u.pinHash;
}

function validPin(pin) {
  return typeof pin === 'string' &&
    pin.length >= PIN_LEN_MIN && pin.length <= PIN_LEN_MAX &&
    /^\d+$/.test(pin);
}

// ── Session vault ───────────────────────────────────────────

export function isVaultUnlocked() {
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function lockVault() {
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent('vault:locked'));
}

/** Prompt for PIN; returns true on unlock, false on cancel/wrong. */
export async function requestUnlock(reason = 'this entry is locked') {
  if (isVaultUnlocked()) return true;
  if (!(await hasPin())) {
    // First-time PIN setup flow
    return new Promise(resolve => openPinModal({ mode: 'setup', reason, resolve }));
  }
  return new Promise(resolve => openPinModal({ mode: 'unlock', reason, resolve }));
}

// ── Entry-level locking ─────────────────────────────────────

/** Toggle `locked` on an entry. Caller is responsible for persisting. */
export function toggleEntryLock(entry) {
  return { ...entry, locked: !entry.locked, lockedAt: !entry.locked ? new Date().toISOString() : null };
}

/** Pure check used by render functions. */
export function isLocked(entry) {
  return !!(entry && entry.locked && !isVaultUnlocked());
}

/** Returns a redacted display copy of an entry's user-visible text fields. */
export function redact(entry) {
  if (!isLocked(entry)) return entry;
  const REDACTED = '🔒 locked';
  return {
    ...entry,
    title:       entry.title       ? REDACTED : '',
    body:        entry.body        ? REDACTED : '',
    subject:     entry.subject     ? REDACTED : '',
    observation: entry.observation ? REDACTED : '',
    note:        entry.note        ? REDACTED : '',
    freeform:    entry.freeform    ? REDACTED : '',
    oneSentence: entry.oneSentence ? REDACTED : '',
    attachments: [],
  };
}

// ── Modal ────────────────────────────────────────────────────

function openPinModal({ mode, reason, resolve }) {
  document.querySelectorAll('.lock-modal').forEach(el => el.remove());
  const isSetup = mode === 'setup';
  const modal = document.createElement('div');
  modal.className = 'lock-modal';
  modal.innerHTML = `
    <div class="lock-card" role="dialog" aria-modal="true" aria-label="${isSetup ? 'set up PIN' : 'enter PIN'}">
      <div class="lock-icon">🔒</div>
      <h2 class="lock-title">${isSetup ? 'set a vault PIN' : 'enter vault PIN'}</h2>
      <div class="lock-sub">${esc(reason)}</div>
      ${isSetup ? `<div class="lock-hint">4–12 digits · used to view locked entries</div>` : ''}
      <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12"
             class="lock-input" id="lk-pin" autocomplete="off"
             placeholder="${isSetup ? 'new PIN' : 'PIN'}">
      ${isSetup ? `<input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12"
             class="lock-input" id="lk-pin2" autocomplete="off" placeholder="confirm PIN">` : ''}
      <div class="lock-err" id="lk-err"></div>
      <div class="lock-actions">
        <button class="btn" id="lk-cancel">cancel</button>
        <button class="btn is-primary" id="lk-go">${isSetup ? 'set PIN' : 'unlock'}</button>
      </div>
      ${isSetup ? '' : `<button class="lock-forgot" id="lk-forgot" type="button">forgot PIN?</button>`}
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('#lk-forgot')?.addEventListener('click', () => {
    // Branching:
    //   · logged in + email verified → server-side OTP flow (professional path)
    //   · everyone else              → client-side "type RESET" fallback
    const u = getCachedUser();
    if (isAuthed() && u?.emailVerified) {
      openOtpResetFlow(modal, resolve);
    } else {
      openForgotFlow(modal, resolve, !isAuthed() ? 'guest' : 'unverified');
    }
  });

  const pin1 = modal.querySelector('#lk-pin');
  const pin2 = modal.querySelector('#lk-pin2');
  const err  = modal.querySelector('#lk-err');
  setTimeout(() => pin1.focus(), 50);

  const close = (val) => { modal.remove(); resolve(val); };

  modal.querySelector('#lk-cancel').addEventListener('click', () => close(false));
  modal.addEventListener('click', e => { if (e.target === modal) close(false); });

  const submit = async () => {
    err.textContent = '';
    const v = pin1.value;
    if (isSetup) {
      if (!validPin(v))       { err.textContent = `PIN must be ${PIN_LEN_MIN}–${PIN_LEN_MAX} digits`; return; }
      if (v !== pin2.value)   { err.textContent = `PINs don't match`; return; }
      try { await setPin(v); close(true); }
      catch (e) { err.textContent = e.message; }
    } else {
      const ok = await verifyPin(v);
      if (!ok) {
        err.textContent = 'wrong PIN';
        pin1.value = '';
        pin1.focus();
        modal.querySelector('.lock-card').classList.add('shake');
        setTimeout(() => modal.querySelector('.lock-card')?.classList.remove('shake'), 400);
        return;
      }
      sessionStorage.setItem(SESSION_KEY, '1');
      window.dispatchEvent(new CustomEvent('vault:unlocked'));
      close(true);
    }
  };
  modal.querySelector('#lk-go').addEventListener('click', submit);
  pin1.addEventListener('keydown', e => { if (e.key === 'Enter') (isSetup ? pin2 : modal.querySelector('#lk-go')).focus(); });
  pin2?.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

// ── Forgot-PIN flow ─────────────────────────────────────────
// Hard confirmation: user types "RESET" to prove intent. We then wipe
// the PIN and clear `locked` on every entry. Entries are NOT deleted.

function openForgotFlow(parentModal, parentResolve, mode = 'guest') {
  parentModal.remove();
  const explainer = mode === 'guest'
    ? 'you\'re not signed in to the cloud — recovery is only possible on this device.'
    : 'your email isn\'t verified yet — without a verified email we can\'t send a one-time code.';
  const modal = document.createElement('div');
  modal.className = 'lock-modal';
  modal.innerHTML = `
    <div class="lock-card" role="dialog" aria-modal="true" aria-label="reset PIN">
      <div class="lock-icon">⚠️</div>
      <h2 class="lock-title">reset your PIN</h2>
      <div class="lock-sub">${esc(explainer)}</div>
      <div class="lock-hint">this will clear your PIN and unlock every entry you previously locked. your entries are <strong>not deleted</strong>.</div>
      <div class="lock-warn">type <strong>RESET</strong> below to confirm</div>
      <input type="text" class="lock-input lock-input-text" id="lk-confirm" autocomplete="off" placeholder="RESET">
      <div class="lock-err" id="lk-err"></div>
      <div class="lock-actions">
        <button class="btn" id="lk-back">back</button>
        <button class="btn is-danger" id="lk-reset" disabled>reset PIN</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const input  = modal.querySelector('#lk-confirm');
  const btnGo  = modal.querySelector('#lk-reset');
  const err    = modal.querySelector('#lk-err');
  setTimeout(() => input.focus(), 50);

  const close = (val) => { modal.remove(); parentResolve(val); };

  input.addEventListener('input', () => {
    btnGo.disabled = input.value.trim() !== 'RESET';
  });

  modal.querySelector('#lk-back').addEventListener('click', () => close(false));
  modal.addEventListener('click', e => { if (e.target === modal) close(false); });

  btnGo.addEventListener('click', async () => {
    if (input.value.trim() !== 'RESET') return;
    btnGo.disabled = true;
    btnGo.textContent = 'resetting…';
    err.textContent = '';
    try {
      const { unlockedCount } = await forgotPin();
      paintResetSuccess(modal, unlockedCount);
    } catch (e) {
      err.textContent = e.message || 'reset failed';
      btnGo.disabled = false;
      btnGo.textContent = 'reset PIN';
    }
  });
}

// ── Server-side OTP recovery flow ────────────────────────────
// For logged-in users with a verified email. Three steps:
//   1. Confirm intent
//   2. Server emails a 6-digit code → user pastes it
//   3. On verify, run the local wipe (same `forgotPin()` as the fallback path)

function openOtpResetFlow(parentModal, parentResolve) {
  parentModal.remove();
  const masked = maskEmail(getCachedUser()?.email || '');

  const modal = document.createElement('div');
  modal.className = 'lock-modal';
  modal.innerHTML = `
    <div class="lock-card" role="dialog" aria-modal="true" aria-label="email PIN reset">
      <div class="lock-icon">✉️</div>
      <h2 class="lock-title">email me a code</h2>
      <div class="lock-sub">we'll send a 6-digit code to <strong>${esc(masked)}</strong>. valid for 15 minutes.</div>
      <div class="lock-err" id="lk-err"></div>
      <div class="lock-actions">
        <button class="btn" id="lk-back">cancel</button>
        <button class="btn is-primary" id="lk-send">send code</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const err = modal.querySelector('#lk-err');
  modal.querySelector('#lk-back').addEventListener('click', () => { modal.remove(); parentResolve(false); });
  modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); parentResolve(false); } });

  modal.querySelector('#lk-send').addEventListener('click', async () => {
    const send = modal.querySelector('#lk-send');
    send.disabled = true;
    send.textContent = 'sending…';
    err.textContent = '';
    try {
      await requestPinResetOtp();
      paintOtpEntry(modal, parentResolve);
    } catch (e) {
      err.textContent = e.message;
      send.disabled = false;
      send.textContent = 'send code';
    }
  });
}

function paintOtpEntry(modal, parentResolve) {
  modal.querySelector('.lock-card').innerHTML = `
    <div class="lock-icon">🔢</div>
    <h2 class="lock-title">enter the code</h2>
    <div class="lock-sub">check your inbox — the code expires in 15 minutes.</div>
    <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6"
           class="lock-input" id="lk-otp" autocomplete="one-time-code" placeholder="000000">
    <div class="lock-err" id="lk-err"></div>
    <div class="lock-actions">
      <button class="btn" id="lk-cancel">cancel</button>
      <button class="btn is-primary" id="lk-verify" disabled>verify & reset</button>
    </div>
  `;
  const input  = modal.querySelector('#lk-otp');
  const verify = modal.querySelector('#lk-verify');
  const err    = modal.querySelector('#lk-err');
  setTimeout(() => input.focus(), 50);
  input.addEventListener('input', () => { verify.disabled = !/^\d{6}$/.test(input.value); });

  modal.querySelector('#lk-cancel').addEventListener('click', () => { modal.remove(); parentResolve(false); });

  const submit = async () => {
    if (!/^\d{6}$/.test(input.value)) return;
    verify.disabled = true;
    verify.textContent = 'verifying…';
    err.textContent = '';
    try {
      await verifyPinResetOtp(input.value);
      // Server confirmed → run local wipe
      const { unlockedCount } = await forgotPin();
      paintResetSuccess(modal, unlockedCount);
    } catch (e) {
      err.textContent = e.message + (e.attemptsLeft != null ? ` · ${e.attemptsLeft} attempts left` : '');
      verify.disabled = false;
      verify.textContent = 'verify & reset';
      input.select();
    }
  };
  verify.addEventListener('click', submit);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}

function paintResetSuccess(modal, unlockedCount) {
  modal.querySelector('.lock-card').innerHTML = `
    <div class="lock-icon">✓</div>
    <h2 class="lock-title">PIN cleared</h2>
    <div class="lock-sub">${unlockedCount > 0
      ? `${unlockedCount} entr${unlockedCount === 1 ? 'y' : 'ies'} unlocked. set a new PIN any time from the topbar.`
      : `your PIN is cleared. set a new one any time from the topbar.`}</div>
    <div class="lock-actions">
      <button class="btn is-primary" id="lk-done">done</button>
    </div>
  `;
  modal.querySelector('#lk-done').addEventListener('click', () => { modal.remove(); });
}

function maskEmail(email) {
  const [local, domain] = String(email).split('@');
  if (!local || !domain) return email || '(your email)';
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(2, local.length - 2))}@${domain}`;
}
