// /auth/verified — landing page after the user clicks the email link.
// The backend redirected here with ?ok=1 (success) or ?ok=0&reason=...

import { navigate } from '../router.js';

export async function render() {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const ok     = params.get('ok') === '1';
  const reason = params.get('reason') || '';

  const root = document.createElement('div');
  root.className = 'page page-auth';

  const messages = {
    'bad-token':    'this verification link is malformed.',
    'not-found':    'we couldn\'t find this verification token. it may have been already used or revoked.',
    'used':         'this verification link was already used. your email is verified.',
    'expired':      'this verification link expired (24h limit). request a new one from settings.',
    'server-error': 'something broke on our end. try again in a moment.',
  };

  root.innerHTML = `
    <div class="auth-card">
      <div class="auth-mark">◆ ${ok ? 'verified' : 'verification'}</div>
      <h1 class="auth-title">${ok ? 'email verified' : 'verification issue'}</h1>
      <div class="auth-icon" style="font-size:48px;margin:14px 0">${ok ? '✓' : '⚠️'}</div>
      <p class="auth-body">${ok
        ? 'your email is verified. password and PIN recovery are now active for this account.'
        : (messages[reason] || 'verification could not complete.')}</p>
      <div class="auth-actions">
        <button class="btn is-primary" id="v-go">go to dashboard</button>
        ${ok ? '' : '<button class="btn" id="v-settings">open settings</button>'}
      </div>
    </div>
  `;
  root.querySelector('#v-go').addEventListener('click', () => navigate('/dashboard'));
  root.querySelector('#v-settings')?.addEventListener('click', () => navigate('/settings'));
  return root;
}
