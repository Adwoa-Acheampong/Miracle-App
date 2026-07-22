// /auth/reset/:token — landing page for password reset link from email.

import { navigate } from '../router.js';
import { resetPassword } from '../auth.js';

export async function render([token]) {
  const root = document.createElement('div');
  root.className = 'page page-auth';

  if (!token || token.length !== 64) {
    root.innerHTML = `<div class="auth-card">
      <div class="auth-mark">◆ password reset</div>
      <h1 class="auth-title">invalid link</h1>
      <p class="auth-body">this reset link doesn't look right. open the latest email or request a new one.</p>
      <button class="btn is-primary" id="r-login">back to login</button>
    </div>`;
    root.querySelector('#r-login').addEventListener('click', () => navigate('/login'));
    return root;
  }

  root.innerHTML = `
    <div class="auth-card">
      <div class="auth-mark">◆ password reset</div>
      <h1 class="auth-title">set a new password</h1>
      <p class="auth-body">choose a new password (8+ characters). this signs you out of every device — log in again after.</p>
      <input type="password" class="auth-input" id="r-pw1" placeholder="new password" minlength="8" autocomplete="new-password">
      <input type="password" class="auth-input" id="r-pw2" placeholder="confirm password" minlength="8" autocomplete="new-password">
      <div class="auth-err" id="r-err"></div>
      <div class="auth-actions">
        <button class="btn" id="r-cancel">cancel</button>
        <button class="btn is-primary" id="r-go">set password</button>
      </div>
    </div>
  `;

  const pw1 = root.querySelector('#r-pw1');
  const pw2 = root.querySelector('#r-pw2');
  const err = root.querySelector('#r-err');
  setTimeout(() => pw1.focus(), 50);

  root.querySelector('#r-cancel').addEventListener('click', () => navigate('/login'));

  root.querySelector('#r-go').addEventListener('click', async () => {
    err.textContent = '';
    if (pw1.value.length < 8) return err.textContent = 'password must be at least 8 characters';
    if (pw1.value !== pw2.value) return err.textContent = 'passwords don\'t match';
    try {
      await resetPassword({ token, password: pw1.value });
      root.querySelector('.auth-card').innerHTML = `
        <div class="auth-mark">◆ password reset</div>
        <h1 class="auth-title">password changed</h1>
        <div class="auth-icon" style="font-size:48px;margin:14px 0">✓</div>
        <p class="auth-body">your password is updated. log in with the new password to continue.</p>
        <button class="btn is-primary" id="r-login">go to login</button>
      `;
      root.querySelector('#r-login').addEventListener('click', () => navigate('/login'));
    } catch (e) {
      err.textContent = e.message;
    }
  });

  pw2.addEventListener('keydown', e => { if (e.key === 'Enter') root.querySelector('#r-go').click(); });
  return root;
}
