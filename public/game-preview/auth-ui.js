import {
  isAuthed,
  me,
  login,
  signup,
  forgotPassword,
  sendVerificationEmail,
} from '../auth.js?v=__BUILD__';

const authWorld = document.getElementById('auth-world');
const authForm = document.getElementById('auth-form');
const authStatus = document.getElementById('auth-status');
const nameField = document.querySelector('.auth-name');
const passwordInput = document.getElementById('auth-password');
const submitButton = authForm.querySelector('.auth-submit');
const guestButton = document.getElementById('auth-guest');
const authBlocked = [...document.getElementById('game').children].filter(element => (
  element !== authWorld && element.id !== 'notification-region'
));
const priorInert = new Map(authBlocked.map(element => [element, element.inert]));
let mode = 'login';
let localPreview = false;

export async function requireGameAuth({ showToast } = {}) {
  localPreview = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (localPreview) {
    guestButton.hidden = false;
    document.getElementById('auth-local-note').hidden = false;
  }

  if (isAuthed()) {
    const user = await me();
    if (user) return { user, mode: 'account' };
  }

  authWorld.hidden = false;
  authBlocked.forEach(element => { element.inert = true; });
  document.getElementById('auth-email').focus();

  return new Promise(resolve => {
    document.querySelectorAll('[data-auth-mode]').forEach(button => {
      button.addEventListener('click', () => setMode(button.dataset.authMode));
    });

    authForm.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(authForm);
      const email = String(data.get('email') || '').trim();
      const password = String(data.get('password') || '');
      const name = String(data.get('name') || '').trim();
      authStatus.textContent = '';
      if (!email || !email.includes('@')) return fail('Enter a valid email address.');
      if (password.length < 8) return fail('Password must be at least 8 characters.');
      if (mode === 'signup' && !name) return fail('Tell the sanctuary what to call you.');

      setBusy(true);
      try {
        const result = mode === 'signup'
          ? await signup({
              email,
              password,
              name,
              calling: '',
              anchorVerse: '',
              dayStart: '06:00',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Accra',
            })
          : await login({ email, password });
        if (mode === 'signup' && result.emailSent === false) {
          showToast?.('Account created. Verification delivery needs a retry from Account settings.');
        }
        await enter(result.user, mode === 'signup' ? 'new-account' : 'account', resolve);
      } catch (error) {
        const message = authMessage(error);
        fail(message);
        if (localPreview && /account service|could not reach|unavailable/i.test(message)) {
          guestButton.focus();
        }
      } finally {
        setBusy(false);
      }
    });

    document.getElementById('auth-forgot').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      if (!email || !email.includes('@')) return fail('Enter your email first, then request a reset.');
      setBusy(true);
      try {
        await forgotPassword(email);
        authStatus.textContent = 'If that verified account exists, a reset link is on its way. Check spam too.';
      } finally {
        setBusy(false);
      }
    });

    guestButton.addEventListener('click', () => enter(null, 'local-guest', resolve));
  });
}

export async function retryVerification() {
  const result = await sendVerificationEmail();
  return result;
}

function setMode(next) {
  mode = next === 'signup' ? 'signup' : 'login';
  document.querySelectorAll('[data-auth-mode]').forEach(button => {
    button.setAttribute('aria-selected', button.dataset.authMode === mode ? 'true' : 'false');
  });
  nameField.hidden = mode !== 'signup';
  nameField.querySelector('input').required = mode === 'signup';
  passwordInput.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  submitButton.querySelector('span').textContent = mode === 'signup' ? 'Create account & begin' : 'Begin the pilgrimage';
  document.getElementById('auth-forgot').hidden = mode === 'signup';
  authStatus.textContent = '';
  (mode === 'signup' ? nameField.querySelector('input') : document.getElementById('auth-email')).focus();
}

async function enter(user, entryMode, resolve) {
  if (entryMode === 'new-account') {
    authWorld.classList.add('is-welcoming');
    authStatus.textContent = 'Welcome. The sanctuary is waking.';
    await new Promise(done => setTimeout(done, 1500));
  }
  authWorld.hidden = true;
  authWorld.classList.remove('is-welcoming');
  authBlocked.forEach(element => { element.inert = priorInert.get(element) || false; });
  resolve({ user, mode: entryMode });
}

function fail(message) {
  authStatus.textContent = message;
  authWorld.classList.remove('auth-shake');
  requestAnimationFrame(() => authWorld.classList.add('auth-shake'));
}

function setBusy(busy) {
  submitButton.disabled = busy;
  submitButton.classList.toggle('is-saving', busy);
  document.querySelectorAll('.auth-tabs button, .auth-forgot, .auth-guest').forEach(button => { button.disabled = busy; });
}

function authMessage(error) {
  const message = String(error?.message || 'Could not reach the sanctuary.');
  if (/invalid email or password|invalid credentials/i.test(message)) return 'Email or password is not correct.';
  if (/already registered/i.test(message)) return 'That email already has a sanctuary account. Log in instead.';
  if (/failed to fetch|network|login failed|signup failed/i.test(message)) {
    return localPreview
      ? 'The account service is unavailable in this local preview. Begin the pilgrimage locally below.'
      : 'The sanctuary account service is unavailable. Check your connection and try again.';
  }
  return message;
}
