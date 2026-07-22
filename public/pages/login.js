// Login + signup page. Two-tab UI. On success → reload → boot() routes to
// welcome (new signup) or dashboard (returning login).
//
// Structure:
//   render()           — dispatcher: alreadyIn → renderAlreadyIn, else → renderForm
//   renderAlreadyIn()  — escape hatch when the user is already authed/profiled
//   renderForm()       — the actual login/signup form. Tab switches preserve input.

import { signup, login, getApiBase, setApiBase, isAuthed, forgotPassword } from '../auth.js';
import { saveUser, loadUser } from '../user.js';
import { put } from '../store.js';
import { navigate } from '../router.js';
import { R } from '../util/routes.js';
import { S } from '../util/stores.js';
import { esc } from '../util/esc.js';

const AUTO_REDIRECT_MS = 800;

export async function render() {
  const existingUser = await loadUser();
  const hasProfile   = !!(existingUser && existingUser.name);
  const alreadyIn    = isAuthed() || hasProfile;
  return alreadyIn ? renderAlreadyIn(existingUser) : renderForm();
}

// ─── Already-in escape hatch ──────────────────────────────────────
function renderAlreadyIn(existingUser) {
  const root = document.createElement('div');
  root.className = 'login-stage login-stage-compact';
  const firstName = existingUser?.name
    ? esc(existingUser.name.split(' ')[0].toLowerCase())
    : '';
  root.innerHTML = `
    <div class="login-card">
      <div class="login-mark">
        <span class="login-word">MIRACLE</span>
        <span class="login-tag">you're already in${firstName ? ' - ' + firstName : ''}</span>
      </div>
      <div class="login-already-actions">
        <button class="btn is-primary" id="go-dash">open dashboard</button>
        <button class="btn" id="switch-acct">switch account (sign out first)</button>
      </div>
    </div>
  `;
  root.querySelector('#go-dash').addEventListener('click', () => navigate(R.dashboard));
  root.querySelector('#switch-acct').addEventListener('click', async () => {
    const { logout } = await import('../auth.js');
    await logout();
    root.replaceWith(await render());
  });
  setTimeout(() => {
    if (document.body.contains(root)) navigate(R.dashboard);
  }, AUTO_REDIRECT_MS);
  return root;
}

// ─── Login / signup form ──────────────────────────────────────────
function renderForm() {
  const root = document.createElement('div');
  root.className = 'login-stage login-stage-compact';
  let mode = 'login';                                    // 'login' | 'signup'
  const draft = { email: '', password: '', name: '' };   // preserved across tab swap

  function paint() {
    root.innerHTML = `
      <div class="login-card">
        <div class="login-mark">
          <span class="login-word">MIRACLE</span>
          <span class="login-tag">faith, focus, and follow-through</span>
        </div>

        <div class="login-tabs">
          <button class="login-tab ${mode === 'login'  ? 'is-active' : ''}" data-mode="login">log in</button>
          <button class="login-tab ${mode === 'signup' ? 'is-active' : ''}" data-mode="signup">create account</button>
        </div>

        <form class="login-form" id="login-form" autocomplete="on">
          ${mode === 'signup' ? `
            <label class="login-field">
              <span class="login-label">first name</span>
              <input type="text" name="name" required minlength="1" maxlength="60"
                     placeholder="adwoa" autocomplete="given-name"
                     value="${esc(draft.name)}">
            </label>
          ` : ''}

          <label class="login-field">
            <span class="login-label">email</span>
            <input type="email" name="email" required autocomplete="email"
                   placeholder="you@example.com" value="${esc(draft.email)}">
          </label>

          <label class="login-field">
            <span class="login-label">password</span>
            <input type="password" name="password" required minlength="8"
                   autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"
                   placeholder="at least 8 characters" value="${esc(draft.password)}">
          </label>

          <details class="login-advanced">
            <summary>api endpoint</summary>
            <input type="url" name="api" value="${esc(getApiBase())}"
                   placeholder="leave blank for same-origin" autocomplete="off">
            <span class="meta">defaults to same origin. Only change this if your backend is hosted elsewhere.</span>
          </details>

          <button type="submit" class="btn is-primary login-submit">
            ${mode === 'signup' ? 'create account' : 'log in'}
          </button>
          ${mode === 'login' ? '<button type="button" class="login-forgot" id="login-forgot">forgot password?</button>' : ''}
          <div class="login-error meta" id="login-error"></div>
        </form>

        <div class="login-footer">
          <a href="mailto:cc@miracleapp.site?subject=%5BMiracle%5D%20Help">need help · cc@miracleapp.site</a>
        </div>
      </div>
    `;
    wireForm();
  }

  function captureDraft() {
    const form = root.querySelector('#login-form');
    if (!form) return;
    const fd = new FormData(form);
    draft.email    = String(fd.get('email')    || '');
    draft.password = String(fd.get('password') || '');
    draft.name     = String(fd.get('name')     || '');
  }

  function wireForm() {
    root.querySelectorAll('.login-tab').forEach(b => b.addEventListener('click', () => {
      captureDraft();
      mode = b.dataset.mode;
      paint();
    }));
    root.querySelector('#login-form').addEventListener('submit', handleSubmit);
    root.querySelector('#login-forgot')?.addEventListener('click', () => openForgotForm());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    const apiUrl = String(form.get('api') || '').trim();
    if (apiUrl) setApiBase(apiUrl);

    const errEl = root.querySelector('#login-error');
    errEl.textContent = '';

    try {
      if (mode === 'signup') {
        const r = await signup({
          email:    String(form.get('email')).trim(),
          password: String(form.get('password')),
          name:     String(form.get('name') || '').trim(),
        });
        // Fresh signup → seat not yet set up; boot() routes to welcome.
        await saveUser({
          name:     r.user?.name    || String(form.get('name') || '').trim(),
          calling:  r.user?.calling || '',
          welcomed: false,
        });
        await put(S.meta, { key: 'prefs', value: { theme: 'eden-night', mode: 'minimalist', tweaks: { animations: 'on' } } });
      } else {
        const r = await login({
          email:    String(form.get('email')).trim(),
          password: String(form.get('password')),
        });
        // Returning user → already past welcome.
        await saveUser({
          name:     r.user?.name    || '',
          calling:  r.user?.calling || '',
          welcomed: true,
        });
      }
      // Full reload so boot() re-runs the gate.
      location.hash = '';
      location.reload();
    } catch (e) {
      errEl.textContent = e.message || 'something went wrong';
    }
  }

  paint();
  return root;
}

// ─── Forgot-password modal ────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function openForgotForm() {
  document.querySelectorAll('.forgot-modal').forEach(m => m.remove());
  const modal = document.createElement('div');
  modal.className = 'forgot-modal';
  modal.innerHTML = `
    <div class="forgot-card">
      <div class="auth-mark">◆ password reset</div>
      <h2 class="forgot-title">send reset link</h2>
      <p class="forgot-sub">type the email on your account. if it's verified, we'll send a reset link.</p>
      <input type="email" id="fg-email" class="auth-input" placeholder="you@example.com" autocomplete="email">
      <div class="auth-err" id="fg-err"></div>
      <div class="forgot-actions">
        <button class="btn" id="fg-cancel">cancel</button>
        <button class="btn is-primary" id="fg-send">send link</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  modal.querySelector('#fg-cancel').addEventListener('click', close);

  const input = modal.querySelector('#fg-email');
  setTimeout(() => input.focus(), 50);

  const send = async () => {
    const v = input.value.trim();
    if (!EMAIL_RE.test(v)) {
      modal.querySelector('#fg-err').textContent = 'enter a valid email';
      return;
    }
    await forgotPassword(v);
    modal.querySelector('.forgot-card').innerHTML = `
      <div class="auth-mark">◆ password reset</div>
      <h2 class="forgot-title">check your inbox</h2>
      <div class="auth-icon" style="font-size:42px;margin:14px 0">✉</div>
      <p class="forgot-sub">if an account exists for <strong>${esc(v)}</strong> and the email is verified, a reset link is on the way. it expires in 1 hour.</p>
      <button class="btn is-primary" id="fg-done" style="margin-top:14px">done</button>
    `;
    modal.querySelector('#fg-done').addEventListener('click', close);
  };

  modal.querySelector('#fg-send').addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
}
