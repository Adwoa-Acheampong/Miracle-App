import { apiFetch } from '../auth.js?v=__BUILD__';
import { getDailyRule, saveDailyRule, loadDailyRhythm } from './data.js?v=__BUILD__';
import { icon } from './game-icons.js?v=__BUILD__';

export function createNotificationsUI({ authSession, showToast }) {
  const toggle = document.getElementById('reminder-toggle');
  const save = document.getElementById('reminder-save');
  const status = document.getElementById('reminder-status');
  let subscription = null;
  let syncTimer = 0;

  toggle.addEventListener('click', toggleNotifications);
  save.addEventListener('click', savePreferences);
  window.addEventListener('game:data-changed', scheduleDailyStateSync);

  return { render, syncDailyState };

  async function render() {
    const rule = await getDailyRule();
    document.getElementById('reminder-morning').value = rule.morningReminder || '07:30';
    document.getElementById('reminder-follow').value = rule.followThroughReminder || '19:00';
    if (!supported()) {
      toggle.disabled = true;
      save.disabled = true;
      status.textContent = 'This browser does not support installed-app push notifications.';
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    subscription = await registration.pushManager.getSubscription();
    paintToggle(!!subscription && Notification.permission === 'granted');
    status.textContent = subscription
      ? 'Reminders can arrive while the installed app is closed.'
      : installedMode()
        ? 'Reminders are off.'
        : 'Install Miracle on the Home Screen before enabling reminders.';
  }

  async function toggleNotifications() {
    if (!authSession?.user) return showToast('Sign in before enabling cross-device reminders.');
    if (subscription) return disableNotifications();
    if (!installedMode() && /iPad|iPhone|iPod/.test(navigator.userAgent)) {
      return showToast('Add Miracle to the Home Screen, then enable reminders inside the installed app.');
    }
    toggle.disabled = true;
    status.textContent = 'Preparing reminders...';
    try {
      const keyResponse = await apiFetch('/notifications/vapid-key');
      const keyData = await keyResponse.json().catch(() => ({}));
      if (!keyResponse.ok || !keyData.publicKey) throw new Error(keyData.error || 'Push keys are not configured yet.');
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Notification permission was not granted.');
      const registration = await navigator.serviceWorker.ready;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64urlToBytes(keyData.publicKey),
      });
      const response = await apiFetch('/notifications/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription: subscription.toJSON(), timezone: timeZone(), locale: navigator.language }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not store this device.');
      await savePreferences(true);
      paintToggle(true);
      status.textContent = 'Reminders can arrive while the installed app is closed.';
      await syncDailyState();
    } catch (error) {
      await subscription?.unsubscribe().catch(() => {});
      subscription = null;
      paintToggle(false);
      status.textContent = error.message;
    } finally {
      toggle.disabled = false;
    }
  }

  async function disableNotifications() {
    toggle.disabled = true;
    try {
      const endpoint = subscription.endpoint;
      await apiFetch('/notifications/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) });
      await subscription.unsubscribe();
      subscription = null;
      await savePreferences(false);
      paintToggle(false);
      status.textContent = 'Reminders are off.';
    } finally {
      toggle.disabled = false;
    }
  }

  async function savePreferences(forceEnabled = null) {
    const current = await getDailyRule();
    const morningReminder = document.getElementById('reminder-morning').value || '07:30';
    const followThroughReminder = document.getElementById('reminder-follow').value || '19:00';
    const enabled = forceEnabled ?? (!!subscription && Notification.permission === 'granted');
    await saveDailyRule({ ...current, morningReminder, followThroughReminder, remindersEnabled: enabled });
    if (authSession?.user) {
      const response = await apiFetch('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          enabled,
          morningTime: morningReminder,
          followTime: followThroughReminder,
          quietFrom: current.quietFrom || '21:30',
          quietUntil: current.quietUntil || '07:00',
          timezone: timeZone(),
        }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Could not save reminder times.');
    }
    status.textContent = enabled ? 'Reminder times saved.' : 'Times saved; reminders remain off.';
    showToast('Reminder times saved.');
  }

  function scheduleDailyStateSync() {
    clearTimeout(syncTimer);
    syncTimer = window.setTimeout(syncDailyState, 500);
  }

  async function syncDailyState() {
    if (!authSession?.user || !subscription) return;
    const rhythm = await loadDailyRhythm();
    await apiFetch('/notifications/daily-state', {
      method: 'POST',
      body: JSON.stringify({
        date: rhythm.date,
        resolved: rhythm.resolved,
        total: rhythm.total,
        openLoops: rhythm.openLoops.length,
        complete: rhythm.complete,
      }),
    }).catch(() => {});
  }

  function paintToggle(enabled) {
    toggle.classList.toggle('is-active', enabled);
    toggle.innerHTML = `${icon(enabled ? 'bell-off' : 'bell', { size: 18 })}<span>${enabled ? 'Turn reminders off' : 'Enable installed-app reminders'}</span>`;
  }
}

function supported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

function installedMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function timeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function base64urlToBytes(value) {
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
