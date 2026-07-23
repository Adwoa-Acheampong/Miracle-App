import { icon } from './game-icons.js?v=__BUILD__';
import { ROOMS, featureFor, featuresForRoom, allDirectoryItems, resolveDefault } from './features.js?v=__BUILD__';
import {
  saveFeature,
  listFeature,
  trashRecord,
  restoreRecord,
  permanentlyDeleteRecord,
  listTrash,
  searchHouse,
  projectHouseState,
  activityFeed,
  completeTask,
  saveFocusSession,
  getFocusDashboard,
  listFocusTargets,
  saveBookMarks,
  getDailySpread,
  getPreference,
  setPreference,
  getMojiConfig,
  todayKey,
} from './data.js?v=__BUILD__';
import { renderAttachmentStrip } from '../attach.js?v=__BUILD__';
import { renderBitmoji } from '../pages/bitmoji.js?v=__BUILD__';
import { loadHistory, saveHistory, clearHistory, streamChat } from '../nes-client.js?v=__BUILD__';
import { logout } from '../auth.js?v=__BUILD__';
import { retryVerification } from './auth-ui.js?v=__BUILD__';
import { esc } from '../util/esc.js?v=__BUILD__';
import { createRhythmBibleUI } from './rhythm-bible-ui.js?v=__BUILD__';
import { createNotificationsUI } from './notifications.js?v=__BUILD__';
import { createFocusGarden, pickFocusReward } from './focus-garden.js?v=__BUILD__';

const roomMap = document.getElementById('room-map');
const roomInterface = document.getElementById('room-interface');
const roomTitle = document.getElementById('room-title');
const roomSubtitle = document.getElementById('room-subtitle');
const growthLevel = document.getElementById('growth-level');
const growthFill = document.getElementById('growth-fill');
const featureObject = document.getElementById('feature-object');
const featureIcon = document.getElementById('feature-icon');
const featureName = document.getElementById('feature-name');
const featureVerb = document.getElementById('feature-verb');
const featureDots = document.getElementById('feature-dots');
const directory = document.getElementById('directory');
const directoryBody = document.getElementById('directory-body');
const featurePanel = document.getElementById('feature-panel');
const panelContent = document.getElementById('panel-content');
const panelActions = document.getElementById('panel-actions');
const panelSave = document.getElementById('panel-save');
const focusWorld = document.getElementById('focus-world');
const bookWorld = document.getElementById('book-world');
const searchWorld = document.getElementById('search-world');
const trashWorld = document.getElementById('trash-world');
const signsWorld = document.getElementById('signs-world');
const nesWorld = document.getElementById('nes-world');
const settingsWorld = document.getElementById('settings-world');
const rhythmWorld = document.getElementById('rhythm-world');
const bibleWorld = document.getElementById('bible-world');
const achievementReveal = document.getElementById('achievement-reveal');
const welcomeTour = document.getElementById('welcome-tour');
const mojiCameo = document.getElementById('moji-cameo');

const specialWorlds = [rhythmWorld, bibleWorld, focusWorld, bookWorld, searchWorld, trashWorld, signsWorld, nesWorld, settingsWorld];
const growthNames = ['quiet', 'kindled', 'growing', 'rooted', 'radiant'];
const tourSlides = [
  { icon: 'door-open', title: 'Your life shapes the sanctuary', copy: 'Prayer, work, care, and memory are the moves. The world changes only after something real is saved.' },
  { icon: 'sunrise', title: 'Begin at Morning Gate', copy: 'Anchor in prayer, aim at one priority, and name your honest inner weather. Nothing is prefilled or fabricated.' },
  { icon: 'map', title: 'Rooms hold your life', copy: 'Chapel, Workshop, Garden, and Archive replace the old feature wall. Swipe through objects or use the directory at any time.' },
  { icon: 'sparkles', title: 'Miracle Sparks tell the truth', copy: 'A Spark appears only after a successful save. Repeated real actions gather into permanent Miracle Signs.' },
  { icon: 'wand-sparkles', title: 'Hidden tools still glow', copy: 'The Nes lantern, Living Book, search, trash, and Moji are always reachable. Pulsing edges mark something you can touch.' },
];

export function createHouseUI({ world, soundscape, showToast, pulseHaptic, authSession }) {
  let houseState = null;
  let activeRoomId = null;
  let activeFeatureId = null;
  let activeFeatureIndex = 0;
  let activeRecord = null;
  let activeAttachments = [];
  let lastOverlayFocus = null;
  let tourIndex = 0;
  let mojiTimer = 0;
  let roomBusy = false;
  let focus = createFocusState();
  let focusGarden = null;
  let focusTargets = [];
  let focusDashboard = null;
  let bookDate = todayKey();
  let selectedSticker = '';
  let nesHistory = loadHistory();
  let achievementFocus = null;
  const dailySystems = createRhythmBibleUI({ openSpecial, openFeature, showToast, soundscape, pulseHaptic });
  const notificationsUI = createNotificationsUI({ authSession, showToast });

  hydrateStaticIcons();
  renderDirectory();
  bindCoreEvents();
  bindFeaturePanel();
  bindFocus();
  bindBook();
  bindSearch();
  bindNes();
  bindSettings();
  bindTour();

  return {
    async showHouse(nextState = null) {
      houseState = nextState || await projectHouseState();
      paintHouseGrowth();
      await applyStoredSettings();
      scheduleMoji();
      const toured = await getPreference('tourComplete', false);
      if (!toured) window.setTimeout(() => openTour(), 700);
    },
    enterRoom,
    openDirectory,
    openSigns,
    openNes,
    openRhythm: dailySystems.openRhythm,
    openBible: dailySystems.openBible,
  };

  function bindCoreEvents() {
    roomMap.querySelectorAll('[data-room]').forEach(button => {
      button.addEventListener('click', () => enterRoom(button.dataset.room));
    });
    document.getElementById('atrium-button').addEventListener('click', returnToAtrium);
    document.getElementById('feature-prev').addEventListener('click', () => shiftFeature(-1));
    document.getElementById('feature-next').addEventListener('click', () => shiftFeature(1));
    featureObject.addEventListener('click', () => openFeature(activeFeatureId));
    document.getElementById('directory-toggle').addEventListener('click', openDirectory);
    document.getElementById('signs-button').addEventListener('click', openSigns);
    document.getElementById('lantern-button').addEventListener('click', openNes);
    document.getElementById('moji-button')?.addEventListener('click', () => {
      showMoji('wave', 'I am here. Pick one faithful thing and we will tend it together.', { force: true });
    });
    document.querySelectorAll('[data-close-directory]').forEach(button => button.addEventListener('click', closeDirectory));
    document.querySelectorAll('[data-close-panel]').forEach(button => button.addEventListener('click', closeFeaturePanel));
    document.querySelectorAll('[data-close-special]').forEach(button => button.addEventListener('click', closeSpecialWorld));
    document.querySelector('[data-dismiss-moji]')?.addEventListener('click', dismissMoji);
    document.getElementById('achievement-close').addEventListener('click', closeAchievement);

    directory.addEventListener('click', event => {
      const featureButton = event.target.closest('[data-directory-feature]');
      if (featureButton) {
        closeDirectory();
        const feature = featureFor(featureButton.dataset.directoryFeature);
        if (feature?.room && feature.room !== activeRoomId) {
          enterRoom(feature.room, { featureId: feature.id });
        } else {
          openFeature(feature.id);
        }
        return;
      }
      const roomButton = event.target.closest('[data-directory-room]');
      if (roomButton) {
        closeDirectory();
        enterRoom(roomButton.dataset.directoryRoom);
        return;
      }
      const action = event.target.closest('[data-directory-action]')?.dataset.directoryAction;
      if (action === 'onboarding') { closeDirectory(); openTour(); }
      if (action === 'settings') { closeDirectory(); openSettings(); }
      if (action === 'trash') { closeDirectory(); openTrash(); }
    });

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (!welcomeTour.hidden) return closeTour(false);
      if (!directory.hidden) return closeDirectory();
      if (!featurePanel.hidden) return closeFeaturePanel();
      if (specialWorlds.some(worldEl => !worldEl.hidden)) return closeSpecialWorld();
      if (!roomInterface.hidden) return returnToAtrium();
    });
  }

  async function enterRoom(roomId, { featureId = null } = {}) {
    const room = ROOMS[roomId];
    if (!room || roomBusy) return;
    roomBusy = true;
    pulseHaptic(8);
    activeRoomId = roomId;
    activeFeatureIndex = Math.max(0, featuresForRoom(roomId).findIndex(feature => feature.id === featureId));
    roomMap.hidden = true;
    roomInterface.hidden = false;
    roomInterface.classList.add('is-travelling');
    roomTitle.textContent = room.name;
    roomSubtitle.textContent = room.subtitle;
    paintFeature();
    paintRoomGrowth();
    soundscape.travel?.();
    await world.travelToRoom?.(roomId);
    roomInterface.classList.remove('is-travelling');
    roomBusy = false;
    if (featureId) openFeature(featureId);
  }

  async function returnToAtrium() {
    if (roomBusy) return;
    roomBusy = true;
    closeFeaturePanel();
    closeSpecialWorld();
    roomInterface.classList.add('is-travelling');
    await world.returnAtrium?.();
    roomInterface.hidden = true;
    roomInterface.classList.remove('is-travelling');
    roomMap.hidden = false;
    activeRoomId = null;
    roomBusy = false;
    showToast('The atrium is open.');
  }

  function shiftFeature(direction) {
    const features = featuresForRoom(activeRoomId);
    if (!features.length) return;
    activeFeatureIndex = (activeFeatureIndex + direction + features.length) % features.length;
    paintFeature(direction);
    pulseHaptic(6);
  }

  function paintFeature(direction = 0) {
    const features = featuresForRoom(activeRoomId);
    const feature = features[activeFeatureIndex] || features[0];
    if (!feature) return;
    activeFeatureId = feature.id;
    featureIcon.innerHTML = icon(feature.icon, { size: 42, stroke: 1.25 });
    featureName.textContent = feature.name;
    featureVerb.textContent = feature.verb;
    featureObject.setAttribute('aria-label', `${feature.verb}. ${feature.description}`);
    featureObject.classList.remove('shift-left', 'shift-right');
    if (direction) {
      featureObject.classList.add(direction > 0 ? 'shift-right' : 'shift-left');
      window.setTimeout(() => featureObject.classList.remove('shift-left', 'shift-right'), 260);
    }
    featureDots.innerHTML = features.map((_, index) => `<i class="${index === activeFeatureIndex ? 'is-active' : ''}"></i>`).join('');
  }

  function paintHouseGrowth() {
    if (!houseState) return;
    roomMap.querySelectorAll('[data-room]').forEach(button => {
      const growth = houseState.rooms[button.dataset.room];
      button.dataset.level = String(growth?.level || 0);
      button.querySelector('i')?.style.setProperty('--growth', `${Math.round((growth?.progress || 0) * 100)}%`);
      button.setAttribute('aria-label', `${button.textContent.trim()}, ${growthNames[growth?.level || 0]}`);
    });
    document.getElementById('signs-button').classList.toggle('has-signs', houseState.signs.length > 0);
  }

  function paintRoomGrowth() {
    const growth = houseState?.rooms?.[activeRoomId] || { level: 0, progress: 0 };
    growthLevel.textContent = growthNames[growth.level] || growthNames[0];
    growthFill.style.width = `${Math.round(growth.progress * 100)}%`;
  }

  function openDirectory() {
    lastOverlayFocus = document.activeElement;
    directory.hidden = false;
    directory.querySelector('button')?.focus();
  }

  function closeDirectory() {
    if (directory.hidden) return;
    directory.hidden = true;
    lastOverlayFocus?.focus?.();
  }

  function renderDirectory() {
    directoryBody.innerHTML = allDirectoryItems().map(room => `
      <section class="directory-room">
        <button class="directory-room-name" type="button" data-directory-room="${room.id}">
          <span>${icon(room.icon, { size: 20 })}</span>
          <span><strong>${esc(room.name)}</strong><small>${esc(room.subtitle)}</small></span>
          <span>${icon('chevron-right', { size: 16 })}</span>
        </button>
        <div class="directory-features">
          ${room.features.map(feature => `<button type="button" data-directory-feature="${feature.id}">${icon(feature.icon, { size: 16 })}<span>${esc(feature.name)}</span></button>`).join('')}
        </div>
      </section>
    `).join('');
  }

  async function openFeature(featureId, record = null) {
    const feature = featureFor(featureId);
    if (!feature) return;
    activeFeatureId = featureId;
    if (feature.special === 'rhythm') return dailySystems.openRhythm();
    if (feature.special === 'bible') return dailySystems.openBible();
    if (feature.special === 'focus') return openFocus();
    if (feature.special === 'book') return openBook();
    if (feature.special === 'search') return openSearch();
    if (feature.special === 'trash') return openTrash();

    lastOverlayFocus = document.activeElement;
    activeRecord = record;
    activeAttachments = Array.isArray(record?.attachments) ? record.attachments.slice() : [];
  document.getElementById('panel-room').textContent = ROOMS[feature.room]?.name || 'Miracle Sanctuary';
    document.getElementById('panel-title').textContent = record ? `Edit ${feature.name}` : feature.name;
    document.getElementById('panel-description').textContent = feature.description;
    featurePanel.hidden = false;
    setPanelTab(record ? 'new' : 'new');
    renderFeatureForm(feature, record);
    requestAnimationFrame(() => panelContent.querySelector('input, textarea, select')?.focus());
  }

  function bindFeaturePanel() {
    document.querySelectorAll('[data-panel-tab]').forEach(button => {
      button.addEventListener('click', () => setPanelTab(button.dataset.panelTab));
    });
    panelSave.addEventListener('click', commitFeatureForm);
    panelContent.addEventListener('click', async event => {
      const editButton = event.target.closest('[data-entry-edit]');
      if (editButton) {
        const rows = await listFeature(activeFeatureId);
        const feature = featureFor(activeFeatureId);
        const row = rows.find(item => String(recordKey(feature.store, item)) === editButton.dataset.entryEdit);
        if (row) openFeature(activeFeatureId, row);
        return;
      }
      const deleteButton = event.target.closest('[data-entry-trash]');
      if (deleteButton) {
        const feature = featureFor(activeFeatureId);
        await trashRecord(feature.store, deleteButton.dataset.entryTrash);
        await refreshWorld(`${feature.name} moved to Trash.`);
        renderRecent(feature);
        return;
      }
      const completeButton = event.target.closest('[data-task-complete]');
      if (completeButton) {
        await completeTask(completeButton.dataset.taskComplete, completeButton.dataset.completed !== 'true');
        await refreshWorld(completeButton.dataset.completed === 'true' ? 'Task reopened.' : 'Task complete. The Workshop changed.');
        renderRecent(featureFor('tasks'));
      }
    });
  }

  function setPanelTab(tab) {
    document.querySelectorAll('[data-panel-tab]').forEach(button => {
      button.setAttribute('aria-selected', button.dataset.panelTab === tab ? 'true' : 'false');
    });
    if (tab === 'recent') {
      panelActions.hidden = true;
      renderRecent(featureFor(activeFeatureId));
    } else {
      panelActions.hidden = false;
      activeRecord = null;
      renderFeatureForm(featureFor(activeFeatureId));
    }
  }

  function renderFeatureForm(feature, record = null) {
    if (!feature?.fields) return;
    const defaults = { ...(feature.defaults?.() || {}), ...(record || {}) };
    panelContent.innerHTML = `
      <form class="feature-form" id="feature-form" novalidate>
        ${feature.fields.map(field => renderField(field, displayValue(feature.id, field.key, defaults[field.key]))).join('')}
        ${renderLinkedFocusLog(record)}
        <div class="attachments-field"><span class="field-label">Images</span><div id="feature-attachments"></div></div>
        <p class="field-error" id="feature-form-error" role="alert"></p>
      </form>
    `;
    activeRecord = record;
    activeAttachments = Array.isArray(record?.attachments) ? record.attachments.slice() : [];
    renderAttachmentStrip(panelContent.querySelector('#feature-attachments'), activeAttachments, {
      onChange: next => { activeAttachments = next; },
    });
  }

  async function renderRecent(feature) {
    if (!feature?.store) return;
    panelContent.innerHTML = '<div class="loading-mark" aria-label="Loading"></div>';
    const rows = await listFeature(feature.id);
    panelContent.innerHTML = rows.length ? `<div class="entry-path">${rows.slice(0, 30).map(row => renderEntry(feature, row)).join('')}</div>` : `<p class="quiet-empty">Nothing has been placed here yet.</p>`;
  }

  async function commitFeatureForm() {
    const feature = featureFor(activeFeatureId);
    const form = document.getElementById('feature-form');
    if (!feature || !form) return;
    const error = form.querySelector('#feature-form-error');
    const values = {};
    let invalid = null;
    for (const field of feature.fields) {
      const control = form.elements[field.key];
      const value = control?.value ?? '';
      if (field.required && !String(value).trim()) invalid = invalid || control;
      values[field.key] = value;
    }
    if (invalid) {
      error.textContent = 'Complete the highlighted move before saving.';
      invalid.setAttribute('aria-invalid', 'true');
      invalid.focus();
      soundscape.error?.();
      return;
    }
    panelSave.disabled = true;
    panelSave.classList.add('is-saving');
    error.textContent = '';
    try {
      values.attachments = activeAttachments;
      const wasEditing = !!activeRecord;
      await saveFeature(feature.id, values, activeRecord);
      soundscape.confirm?.(Math.max(0, Object.keys(ROOMS).indexOf(feature.room) - 1));
      pulseHaptic([8, 22, 10]);
      world.celebrateRoom?.(feature.room);
      await refreshWorld(wasEditing ? `${feature.name} updated.` : `${feature.name} saved. A Miracle Spark appeared.`);
      showMoji(feature.room === 'chapel' ? 'pray' : feature.room === 'workshop' ? 'banner' : feature.room === 'garden' ? 'sip' : 'read', mojiLineFor(feature.room));
      activeRecord = null;
      setPanelTab('recent');
    } catch (saveError) {
      console.error('[game] feature save failed', saveError);
      error.textContent = 'That move did not save. Nothing was rewarded. Try again.';
      soundscape.error?.();
    } finally {
      panelSave.disabled = false;
      panelSave.classList.remove('is-saving');
    }
  }

  function closeFeaturePanel() {
    if (featurePanel.hidden) return;
    featurePanel.hidden = true;
    panelContent.replaceChildren();
    activeRecord = null;
    lastOverlayFocus?.focus?.();
  }

  function renderField(field, rawValue) {
    const value = rawValue ?? resolveDefault(field);
    const common = `name="${field.key}" id="field-${field.key}" ${field.required ? 'required' : ''} ${field.maxlength ? `maxlength="${field.maxlength}"` : ''} ${field.min != null ? `min="${field.min}"` : ''} ${field.max != null ? `max="${field.max}"` : ''} ${field.step != null ? `step="${field.step}"` : ''}`;
    let control;
    if (field.type === 'textarea') {
      control = `<textarea ${common} rows="4" placeholder="${esc(field.placeholder || '')}">${esc(value)}</textarea>`;
    } else if (field.type === 'select') {
      control = `<select ${common}>${field.options.map(option => `<option value="${esc(option)}" ${String(value || resolveDefault(field)) === option ? 'selected' : ''}>${esc(labelize(option))}</option>`).join('')}</select>`;
    } else {
      control = `<input ${common} type="${field.type}" value="${esc(value)}" placeholder="${esc(field.placeholder || '')}">`;
    }
    return `<label class="game-field" for="field-${field.key}"><span>${esc(field.label)}</span>${control}</label>`;
  }

  function renderEntry(feature, row) {
    const key = recordKey(feature.store, row);
    const title = entryTitle(feature, row);
    const meta = entryMeta(feature, row);
    const completed = feature.id === 'tasks' && !!row.completedAt;
    return `
      <article class="entry-stone ${completed ? 'is-complete' : ''}">
        ${feature.id === 'tasks' ? `<button class="entry-check" type="button" data-task-complete="${esc(key)}" data-completed="${completed}" aria-label="${completed ? 'Reopen' : 'Complete'} ${esc(title)}">${icon(completed ? 'check' : 'circle', { size: 18 })}</button>` : `<span class="entry-mark">${icon(feature.icon, { size: 18 })}</span>`}
        <button class="entry-copy" type="button" data-entry-edit="${esc(key)}"><strong>${esc(title)}</strong><small>${esc(meta)}</small></button>
        <button class="entry-trash" type="button" data-entry-trash="${esc(key)}" aria-label="Move ${esc(title)} to Trash">${icon('trash-2', { size: 17 })}</button>
      </article>
    `;
  }

  function openSpecial(worldEl) {
    closeFeaturePanel();
    closeDirectory();
    specialWorlds.forEach(item => { item.hidden = item !== worldEl; });
    worldEl.hidden = false;
    lastOverlayFocus = document.activeElement;
    worldEl.querySelector('button, input, textarea')?.focus();
  }

  function closeSpecialWorld() {
    const open = specialWorlds.find(item => !item.hidden);
    if (!open) return;
    if (open === bibleWorld) dailySystems.stopAudio();
    open.hidden = true;
    if (open === focusWorld) {
      if (focus.state === 'running') pauseFocus();
      stopFocusAudio(false);
    }
    lastOverlayFocus?.focus?.();
  }

  function bindFocus() {
    const canvas = document.getElementById('focus-growth-canvas');
    focusGarden = createFocusGarden(canvas);
    document.querySelectorAll('[data-focus-minutes]').forEach(button => {
      button.addEventListener('click', () => {
        if (focus.state !== 'ready') return;
        focus.minutes = Number(button.dataset.focusMinutes);
        focus.mode = focus.minutes > 0 ? 'timed' : 'untimed';
        focus.remaining = Math.max(0, focus.minutes * 60);
        document.getElementById('focus-custom-minutes').value = '';
        document.querySelectorAll('[data-focus-minutes]').forEach(item => item.classList.toggle('is-active', item === button));
        paintFocus();
      });
    });
    document.getElementById('focus-custom-minutes').addEventListener('input', event => {
      if (focus.state !== 'ready') return;
      const minutes = Math.max(0, Math.min(480, Number(event.target.value) || 0));
      if (!minutes) return;
      focus.minutes = minutes;
      focus.mode = 'timed';
      focus.remaining = minutes * 60;
      document.querySelectorAll('[data-focus-minutes]').forEach(item => item.classList.remove('is-active'));
      paintFocus();
    });
    document.getElementById('focus-link-type').addEventListener('change', renderFocusTargets);
    document.getElementById('focus-music').addEventListener('change', event => {
      focus.music = event.target.value;
      paintFocusAudio();
    });
    document.getElementById('focus-rain-toggle').addEventListener('click', toggleFocusRain);
    document.getElementById('focus-sound').addEventListener('click', toggleFocusRain);
    document.getElementById('focus-primary').addEventListener('click', toggleFocus);
    document.getElementById('focus-reset').addEventListener('click', resetFocus);
    document.getElementById('focus-finish').addEventListener('click', () => prepareFocusCompletion(false));
    document.getElementById('focus-return').addEventListener('click', returnToFocus);
    document.getElementById('focus-save').addEventListener('click', saveFocusReflection);
    document.getElementById('focus-again').addEventListener('click', () => resetFocus({ clearLabel: true }));
    document.getElementById('focus-benchmark').addEventListener('input', event => {
      document.getElementById('focus-benchmark-output').textContent = `${event.target.value}%`;
    });
  }

  async function openFocus() {
    openSpecial(focusWorld);
    document.getElementById('focus-error').textContent = '';
    await loadFocusContext();
    focusGarden?.resize();
    paintFocus();
  }

  async function toggleFocus() {
    if (focus.state === 'running') return pauseFocus();
    if (focus.state === 'reflecting' || focus.state === 'revealed') return;
    const label = document.getElementById('focus-label').value.trim();
    if (!label) {
      document.getElementById('focus-error').textContent = 'Name the work before planting this session.';
      document.getElementById('focus-label').focus();
      return;
    }
    const linkType = document.getElementById('focus-link-type').value;
    const linkTarget = document.getElementById('focus-link-target');
    if (linkType !== 'general' && !linkTarget.value) {
      document.getElementById('focus-error').textContent = `Choose the ${linkType} this session should return to.`;
      linkTarget.focus();
      return;
    }
    document.getElementById('focus-error').textContent = '';
    if (!focus.reward) {
      focus.reward = pickFocusReward(
        `${todayKey()}:${label}:${linkType}`,
        focusDashboard?.completedCount || 0,
      );
      focusGarden?.setReward(focus.reward, focusProgress());
    }
    focus.music = document.getElementById('focus-music').value;
    focus.state = 'running';
    focus.startedAt = focus.startedAt || Date.now();
    focus.lastTick = Date.now();
    focus.interval = window.setInterval(tickFocus, 250);
    await startFocusAudio();
    showMoji('focus', `Your ${focus.reward.kind === 'flower' ? focus.reward.name : focus.reward.kind} is beginning. Stay with the work in front of you.`, { force: true });
    paintFocus();
  }

  function pauseFocus() {
    if (focus.state !== 'running') return;
    advanceFocusClock();
    clearInterval(focus.interval);
    focus.interval = 0;
    focus.state = 'paused';
    stopFocusAudio(false);
    paintFocus();
  }

  function tickFocus() {
    if (focus.state !== 'running') return;
    advanceFocusClock();
    if (focus.mode === 'timed' && focus.remaining <= 0) {
      prepareFocusCompletion(true);
      return;
    }
    focusGarden?.setProgress(focusProgress());
    paintFocus();
  }

  function advanceFocusClock() {
    if (focus.state !== 'running') return;
    const now = Date.now();
    const delta = Math.max(0, (now - focus.lastTick) / 1000);
    focus.lastTick = now;
    focus.elapsed += delta;
    if (focus.mode === 'timed') focus.remaining = Math.max(0, focus.remaining - delta);
  }

  function prepareFocusCompletion(natural = false) {
    if (focus.state === 'ready' || focus.state === 'reflecting' || focus.state === 'revealed' || focus.saving) return;
    if (focus.state === 'running') advanceFocusClock();
    clearInterval(focus.interval);
    focus.interval = 0;
    focus.natural = natural || (focus.mode === 'timed' && focus.remaining <= 0);
    focus.state = 'reflecting';
    stopFocusAudio(false);
    document.getElementById('focus-kept').checked = focus.natural;
    document.getElementById('focus-completion-title').textContent = focus.natural
      ? 'The covenant is complete. What moved?'
      : 'What moved during this session?';
    document.getElementById('focus-return').hidden = focus.natural;
    document.getElementById('focus-setup').hidden = true;
    document.getElementById('focus-reveal').hidden = true;
    document.getElementById('focus-completion').hidden = false;
    if (focus.natural) {
      focusGarden?.reveal();
      soundscape.reward?.();
    } else {
      focusGarden?.setProgress(focusProgress());
    }
    paintFocus();
    window.setTimeout(() => document.getElementById('focus-achievement').focus(), 40);
  }

  function returnToFocus() {
    if (focus.natural) return;
    focus.state = 'paused';
    document.getElementById('focus-completion').hidden = true;
    document.getElementById('focus-setup').hidden = false;
    paintFocus();
  }

  async function saveFocusReflection() {
    if (focus.state !== 'reflecting' || focus.saving) return;
    const saveButton = document.getElementById('focus-save');
    const kept = document.getElementById('focus-kept').checked;
    const completed = focus.natural || kept;
    const linkType = document.getElementById('focus-link-type').value;
    const linkTarget = document.getElementById('focus-link-target');
    const linkOption = linkTarget.selectedOptions[0];
    focus.saving = true;
    saveButton.disabled = true;
    saveButton.classList.add('is-saving');
    document.getElementById('focus-save-error').textContent = '';
    try {
      await saveFocusSession({
        taskLabel: document.getElementById('focus-label').value,
        minutes: focus.minutes,
        elapsedSecs: Math.max(1, Math.round(focus.elapsed)),
        status: completed ? 'completed' : 'stopped',
        mode: focus.mode,
        linkType,
        linkId: linkType === 'general' ? '' : linkTarget.value,
        achievement: document.getElementById('focus-achievement').value,
        milestone: document.getElementById('focus-milestone').value,
        benchmarkPercent: document.getElementById('focus-benchmark').value,
        reward: { ...focus.reward, earned: completed, progress: completed ? 1 : focusProgress() },
        soundMode: focus.music === 'silent' ? 'silent' : `${focus.music}${focus.rain ? '+rain' : ''}`,
        notes: linkOption?.dataset.meta || '',
      });
      focus.state = 'revealed';
      if (completed) {
        focusGarden?.reveal();
        soundscape.reward?.();
        pulseHaptic([10, 30, 14, 42, 18]);
        world.celebrateRoom?.('workshop');
      }
      renderFocusReveal(completed);
      paintFocus();
      await refreshWorld(completed
        ? `${focus.reward.name} has been added to your Focus Garden.`
        : 'The session was recorded honestly; the seed is waiting for another faithful return.');
      await loadFocusContext();
      showMoji(
        completed ? 'celebrate' : 'encourage',
        completed
          ? `${focus.reward.name} opened. Your work and its fruit are now part of the sanctuary.`
          : 'Honesty belongs in the log too. Begin again when you are ready.',
        { force: true },
      );
    } catch (error) {
      console.error('[game] focus save failed', error);
      document.getElementById('focus-save-error').textContent = 'The session did not save. Please try again.';
    } finally {
      focus.saving = false;
      saveButton.disabled = false;
      saveButton.classList.remove('is-saving');
    }
  }

  function resetFocus({ clearLabel = false } = {}) {
    clearInterval(focus.interval);
    stopFocusAudio(true);
    const minutes = focus.minutes;
    const music = document.getElementById('focus-music').value;
    const rain = focus.rain;
    focus = createFocusState(minutes);
    focus.music = music;
    focus.rain = rain;
    if (clearLabel) document.getElementById('focus-label').value = '';
    document.getElementById('focus-achievement').value = '';
    document.getElementById('focus-milestone').value = '';
    document.getElementById('focus-benchmark').value = '0';
    document.getElementById('focus-benchmark-output').textContent = '0%';
    document.getElementById('focus-kept').checked = false;
    document.getElementById('focus-error').textContent = '';
    document.getElementById('focus-save-error').textContent = '';
    document.getElementById('focus-setup').hidden = false;
    document.getElementById('focus-completion').hidden = true;
    document.getElementById('focus-reveal').hidden = true;
    focusGarden?.setReward(pickFocusReward('waiting-seed'), 0);
    paintFocus();
  }

  function paintFocus() {
    const whole = focus.minutes * 60;
    const displayed = focus.mode === 'untimed' ? focus.elapsed : focus.remaining;
    const ratio = focus.mode === 'untimed' ? focusProgress() : (whole ? focus.remaining / whole : 1);
    const minutes = Math.floor(displayed / 60);
    const seconds = Math.floor(displayed % 60);
    document.getElementById('focus-time').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    document.getElementById('focus-state').textContent = focus.mode === 'untimed' && focus.state === 'ready' ? 'open session' : focus.state;
    document.getElementById('focus-ring').style.setProperty('--focus-angle', `${Math.max(0, ratio * 360)}deg`);
    document.getElementById('focus-primary').innerHTML = icon(focus.state === 'running' ? 'pause' : 'play', { size: 25 });
    document.getElementById('focus-primary').setAttribute('aria-label', focus.state === 'running' ? 'Pause focus' : 'Start or resume focus');
    const locked = focus.state !== 'ready';
    document.querySelectorAll('#focus-setup input:not(#focus-kept), #focus-setup select').forEach(field => { field.disabled = locked; });
    document.querySelectorAll('[data-focus-minutes]').forEach(button => { button.disabled = locked; });
    renderFocusTargets();
    document.getElementById('focus-finish').disabled = focus.state === 'ready';
    const reward = focus.reward;
    document.getElementById('focus-reward-kind').textContent = reward
      ? `${labelize(reward.kind)} growing`
      : 'A seed is waiting';
    document.getElementById('focus-reward-name').textContent = reward?.name || 'Begin to discover what will grow';
    focusGarden?.setProgress(focusProgress());
    paintFocusAudio();
  }

  function focusProgress() {
    if (focus.state === 'revealed' || focus.natural) return 1;
    if (focus.mode === 'untimed') return Math.min(0.94, focus.elapsed / 3600);
    const whole = Math.max(1, focus.minutes * 60);
    return Math.max(0, Math.min(1, focus.elapsed / whole));
  }

  async function loadFocusContext() {
    [focusDashboard, focusTargets] = await Promise.all([getFocusDashboard(), listFocusTargets()]);
    document.getElementById('focus-today-hours').textContent = formatFocusDuration(focusDashboard.todaySeconds);
    document.getElementById('focus-week-hours').textContent = formatFocusDuration(focusDashboard.weekSeconds);
    document.getElementById('focus-bloom-count').textContent = String(focusDashboard.rewardCount);
    document.getElementById('focus-completion-rate').textContent = `${focusDashboard.completionRate}% completed`;
    renderFocusTargets();
    renderFocusHistory();
  }

  function renderFocusTargets() {
    const type = document.getElementById('focus-link-type').value;
    const select = document.getElementById('focus-link-target');
    const group = focusTargets.find(item => item.type === type);
    select.disabled = type === 'general' || !group?.items.length || focus.state !== 'ready';
    if (type === 'general') {
      select.innerHTML = '<option value="">Focus log only</option>';
      return;
    }
    if (!group?.items.length) {
      select.innerHTML = `<option value="">No saved ${esc(group?.label?.toLowerCase() || type)} yet</option>`;
      return;
    }
    const prior = select.value;
    select.innerHTML = `<option value="">Choose ${esc(group.label.toLowerCase())}</option>${group.items.map(item => `<option value="${esc(item.id)}" data-meta="${esc(item.meta)}">${esc(item.label)}${item.meta ? ` · ${esc(item.meta)}` : ''}</option>`).join('')}`;
    if ([...select.options].some(option => option.value === prior)) select.value = prior;
  }

  function renderFocusHistory() {
    const target = document.getElementById('focus-history');
    const sessions = focusDashboard?.sessions?.slice(0, 8) || [];
    if (!sessions.length) {
      target.innerHTML = '<p class="quiet-empty">Your first focused minute will appear here.</p>';
      return;
    }
    target.innerHTML = sessions.map(session => `
      <article class="focus-history-row ${session.status === 'completed' ? 'is-complete' : ''}">
        <span class="focus-history-mark">${icon(session.reward?.kind === 'scene' ? 'image' : session.reward?.kind === 'quote' ? 'quote' : 'flower-2', { size: 18 })}</span>
        <div><strong>${esc(session.taskLabel || 'Focus session')}</strong><small>${formatFocusDuration(session.elapsedSecs)}${session.linkType && session.linkType !== 'general' ? ` · ${esc(labelize(session.linkType))}` : ''}</small>${session.achievement ? `<p>${esc(session.achievement)}</p>` : ''}</div>
        <span class="focus-history-reward">${esc(session.status === 'completed' ? session.reward?.name || 'kept' : 'recorded')}</span>
      </article>
    `).join('');
  }

  function renderFocusReveal(completed) {
    const reward = focus.reward;
    document.getElementById('focus-completion').hidden = true;
    document.getElementById('focus-setup').hidden = true;
    document.getElementById('focus-reveal').hidden = false;
    document.getElementById('focus-reveal-kind').textContent = completed ? `${labelize(reward.kind)} earned` : 'Seed preserved';
    document.getElementById('focus-reveal-title').textContent = completed ? reward.name : `${reward.name} is still growing`;
    document.getElementById('focus-reveal-scientific').textContent = completed ? reward.scientificName : 'Complete a focus covenant to open the full field note.';
    document.getElementById('focus-reveal-origin').textContent = completed ? reward.origin : 'Waiting in your Focus Garden.';
    document.getElementById('focus-reveal-family').textContent = completed ? reward.family : labelize(reward.kind);
    document.getElementById('focus-reveal-detail').textContent = completed ? reward.detail : 'Your elapsed focus was recorded. The reward will fully reveal after a session you mark as kept.';
    document.getElementById('focus-reveal-scripture').textContent = reward.scripture;
  }

  function toggleFocusRain() {
    focus.rain = !focus.rain;
    if (focus.state === 'running') soundscape.focus?.(true, focus.rain);
    paintFocusAudio();
  }

  function paintFocusAudio() {
    const rainEnabled = focus.rain && focus.music !== 'silent';
    for (const id of ['focus-sound', 'focus-rain-toggle']) {
      const button = document.getElementById(id);
      button.setAttribute('aria-checked', String(rainEnabled));
      button.classList.toggle('is-active', rainEnabled);
    }
    const player = document.getElementById('focus-player');
    player.hidden = !isYouTubeFocusMusic(focus.music);
  }

  async function startFocusAudio() {
    await soundscape.start?.();
    soundscape.focus?.(true, focus.rain && focus.music !== 'silent');
    const frame = document.getElementById('focus-youtube');
    if (isYouTubeFocusMusic(focus.music)) {
      const start = focus.music === 'P-XnYn3FUq4' ? 959 : 0;
      const src = `https://www.youtube-nocookie.com/embed/${focus.music}?autoplay=1&playsinline=1&rel=0&enablejsapi=1&start=${start}`;
      if (frame.src !== src) frame.src = src;
      frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
    }
  }

  function stopFocusAudio(clearPlayer = false) {
    soundscape.focus?.(false);
    const frame = document.getElementById('focus-youtube');
    frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
    if (clearPlayer) frame.removeAttribute('src');
  }

  function bindBook() {
    document.getElementById('book-prev').addEventListener('click', () => shiftBookDate(-1));
    document.getElementById('book-next').addEventListener('click', () => shiftBookDate(1));
    document.getElementById('book-edit-toggle').addEventListener('click', () => {
      const tools = document.getElementById('book-tools');
      tools.hidden = !tools.hidden;
      if (!tools.hidden) document.getElementById('book-highlight').focus();
    });
    document.querySelectorAll('[data-sticker]').forEach(button => {
      button.addEventListener('click', () => {
        selectedSticker = button.dataset.sticker;
        document.querySelectorAll('[data-sticker]').forEach(item => item.classList.toggle('is-active', item === button));
      });
    });
    document.getElementById('book-mark-save').addEventListener('click', saveBookDecoration);
  }

  async function openBook() {
    openSpecial(bookWorld);
    await renderBook();
  }

  async function shiftBookDate(days) {
    const next = new Date(`${bookDate}T12:00:00`);
    next.setDate(next.getDate() + days);
    if (next > new Date()) return;
    bookDate = next.toISOString().slice(0, 10);
    document.getElementById('open-book').classList.add(days > 0 ? 'turn-forward' : 'turn-back');
    await renderBook();
    window.setTimeout(() => document.getElementById('open-book').classList.remove('turn-forward', 'turn-back'), 600);
  }

  async function renderBook() {
    const { page, events } = await getDailySpread(bookDate);
    const date = new Date(`${bookDate}T12:00:00`);
    document.getElementById('book-date').textContent = date.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
    const highlights = normalizeMarks(page.bookHighlights);
    const notes = normalizeMarks(page.bookNotes);
    const stickers = normalizeMarks(page.bookStickers);
    document.getElementById('book-left').innerHTML = `
      <p class="book-kicker">${esc(date.toLocaleDateString(undefined, { weekday: 'long' }))}</p>
      <h3>${esc(page.oneSentence || 'An unwritten morning')}</h3>
      ${page.mood ? `<div class="book-mood"><span>inner weather</span><strong>${esc(labelize(page.mood))}</strong></div>` : '<div class="book-mood is-empty"><span>inner weather</span><strong>unlogged</strong></div>'}
      ${page.gratitude?.filter(Boolean).length ? `<div class="book-gratitude"><span>gratitude</span>${page.gratitude.filter(Boolean).map(item => `<p>${esc(item)}</p>`).join('')}</div>` : ''}
      ${highlights.map(mark => `<mark>${esc(mark.text)}</mark>`).join('')}
      ${stickers.filter((_, index) => index % 2 === 0).map(mark => `<i class="page-sticker">${icon(mark.icon || mark.text || 'star', { size: 20 })}</i>`).join('')}
    `;
    document.getElementById('book-right').innerHTML = `
      <p class="book-kicker">what moved</p>
      <div class="book-events">${events.length ? events.slice(0, 9).map(event => `<div><span>${icon(event.feature.icon, { size: 15 })}</span><p><strong>${esc(event.feature.name)}</strong><small>${esc(entryTitle(event.feature, event.row))}</small></p></div>`).join('') : '<p class="book-empty">No saved events on this leaf.</p>'}</div>
      ${page.freeform ? `<blockquote>${esc(page.freeform.slice(0, 420))}</blockquote>` : ''}
      ${notes.map(mark => `<aside class="margin-note">${esc(mark.text)}</aside>`).join('')}
      ${stickers.filter((_, index) => index % 2 === 1).map(mark => `<i class="page-sticker">${icon(mark.icon || mark.text || 'star', { size: 20 })}</i>`).join('')}
      <button class="book-write" type="button" id="book-write-day">${icon('pen-line', { size: 16 })}<span>Write on this day</span></button>
    `;
    document.getElementById('book-write-day').addEventListener('click', () => openFeature('daily', page));
  }

  async function saveBookDecoration() {
    const highlight = document.getElementById('book-highlight').value.trim();
    const note = document.getElementById('book-note').value.trim();
    if (!highlight && !note && !selectedSticker) {
      showToast('Choose a highlight, note, or page mark first.');
      return;
    }
    const { page } = await getDailySpread(bookDate);
    const stamp = new Date().toISOString();
    const next = {
      bookHighlights: [...normalizeMarks(page.bookHighlights), ...(highlight ? [{ id: markId(), text: highlight, createdAt: stamp }] : [])].slice(-8),
      bookNotes: [...normalizeMarks(page.bookNotes), ...(note ? [{ id: markId(), text: note, createdAt: stamp }] : [])].slice(-8),
      bookStickers: [...normalizeMarks(page.bookStickers), ...(selectedSticker ? [{ id: markId(), icon: selectedSticker, createdAt: stamp }] : [])].slice(-10),
    };
    await saveBookMarks(bookDate, next);
    document.getElementById('book-highlight').value = '';
    document.getElementById('book-note').value = '';
    selectedSticker = '';
    document.querySelectorAll('[data-sticker]').forEach(item => item.classList.remove('is-active'));
    soundscape.confirm?.(2);
    world.celebrateRoom?.('archive');
    await refreshWorld('The page remembers your mark.');
    await renderBook();
  }

  function bindSearch() {
    let timer = 0;
    document.getElementById('house-search').addEventListener('input', event => {
      clearTimeout(timer);
      timer = window.setTimeout(() => renderSearch(event.target.value), 180);
    });
    document.getElementById('search-results').addEventListener('click', async event => {
      const result = event.target.closest('[data-search-feature]');
      if (!result) return;
      const feature = featureFor(result.dataset.searchFeature);
      const rows = await listFeature(feature.id);
      const row = rows.find(item => String(recordKey(feature.store, item)) === result.dataset.searchKey);
      if (row) openFeature(feature.id, row);
    });
  }

  function openSearch() {
    openSpecial(searchWorld);
    const input = document.getElementById('house-search');
    input.value = '';
    document.getElementById('search-results').innerHTML = '<p class="quiet-empty">Type two letters to begin.</p>';
    input.focus();
  }

  async function renderSearch(query) {
    const host = document.getElementById('search-results');
    if (query.trim().length < 2) {
      host.innerHTML = '<p class="quiet-empty">Type two letters to begin.</p>';
      return;
    }
    host.innerHTML = '<div class="loading-mark"></div>';
    const results = await searchHouse(query);
    host.innerHTML = results.length ? results.map(result => `
      <button type="button" class="search-result" data-search-feature="${result.featureId}" data-search-key="${esc(result.key)}">
        <span>${icon(result.feature.icon, { size: 19 })}</span>
        <span><strong>${esc(entryTitle(result.feature, result.row))}</strong><small>${esc(result.feature.name)} · ${esc(formatWhen(result.at))}</small></span>
        <span>${icon('chevron-right', { size: 16 })}</span>
      </button>
      `).join('') : '<p class="quiet-empty">Nothing in the sanctuary matches that yet.</p>';
  }

  async function openTrash() {
    openSpecial(trashWorld);
    await renderTrash();
  }

  async function renderTrash() {
    const host = document.getElementById('trash-list');
    const items = await listTrash();
    host.innerHTML = items.length ? items.map(item => {
      const feature = Object.values(featureForStore(item.store));
      const label = trashLabel(item.store, item.row);
      return `<article class="trash-entry" data-trash-store="${esc(item.store)}" data-trash-key="${esc(item.key)}"><span>${icon(feature[0]?.icon || 'trash-2', { size: 18 })}</span><div><strong>${esc(label)}</strong><small>${esc(item.store)} · removes ${esc(formatPurge(item.row.purgeAt))}</small></div><button type="button" data-trash-restore>Restore</button><button type="button" data-trash-delete aria-label="Delete permanently">${icon('trash-2', { size: 17 })}</button></article>`;
    }).join('') : '<p class="quiet-empty">Trash is empty.</p>';
    host.querySelectorAll('[data-trash-restore]').forEach(button => {
      button.addEventListener('click', async () => {
        const row = button.closest('.trash-entry');
        await restoreRecord(row.dataset.trashStore, row.dataset.trashKey);
        await refreshWorld('Record restored. Its Signs are active again.');
        renderTrash();
      });
    });
    host.querySelectorAll('[data-trash-delete]').forEach(button => {
      button.addEventListener('click', async () => {
        const row = button.closest('.trash-entry');
        if (!window.confirm('Permanently delete this record now? This cannot be undone.')) return;
        await permanentlyDeleteRecord(row.dataset.trashStore, row.dataset.trashKey);
        await refreshWorld('Record permanently removed.');
        renderTrash();
      });
    });
  }

  async function openSigns() {
    openSpecial(signsWorld);
    const state = await projectHouseState();
    const feed = await activityFeed(24);
    const summary = document.getElementById('signs-summary');
    summary.innerHTML = `<div class="sign-count"><strong>${state.signs.length}</strong><span>Signs</span></div><div class="spark-count"><strong>${state.sparks - state.signs.length}</strong><span>truthful Sparks</span></div><div class="record-count"><strong>${state.records}</strong><span>living records</span></div>`;
    const earned = document.getElementById('signs-earned');
    earned.innerHTML = state.signs.length ? state.signs.map(sign => `<article><span>${icon('award', { size: 20 })}</span><div><strong>${esc(sign.label)}</strong><small>${esc(sign.copy || signCopy(sign.sign))}</small></div></article>`).join('') : '<p class="quiet-empty">Miracle Signs appear when a pattern has real evidence.</p>';
    const path = document.getElementById('signs-path');
    path.innerHTML = feed.length ? feed.map(event => `<article class="sign-event ${event.kind === 'sign' ? 'is-sign' : ''}"><span>${icon(event.kind === 'sign' ? 'award' : 'sparkles', { size: event.kind === 'sign' ? 24 : 16 })}</span><div><strong>${esc(event.label || 'Miracle Spark')}</strong><small>${esc(ROOMS[event.room]?.name || 'Miracle Sanctuary')} · ${esc(formatWhen(event.at))}</small></div></article>`).join('') : '<p class="quiet-empty">Your first saved move will light the path here.</p>';
  }

  function bindSettings() {
    settingsWorld.querySelectorAll('[data-setting-toggle]').forEach(button => {
      button.addEventListener('click', async () => {
        const key = button.dataset.settingToggle;
        const enabled = button.getAttribute('aria-checked') !== 'true';
        button.setAttribute('aria-checked', enabled ? 'true' : 'false');
        await setPreference(key, enabled);
        applySetting(key, enabled, true);
      });
    });
    document.getElementById('settings-verify').addEventListener('click', async event => {
      const button = event.currentTarget;
      const status = document.getElementById('settings-status');
      button.disabled = true;
      status.textContent = 'Sending verification...';
      try {
        const result = await retryVerification();
        status.textContent = result?.sent === false
          ? 'The email provider did not accept the message. Try again shortly.'
          : 'Verification sent. Check Gmail and Spam.';
      } catch (error) {
        status.textContent = error.message || 'Verification could not be sent yet.';
      } finally {
        button.disabled = false;
      }
    });
    document.getElementById('settings-logout').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      await logout();
      location.reload();
    });
  }

  async function openSettings() {
    openSpecial(settingsWorld);
    await renderSettings();
  }

  async function renderSettings() {
    const values = await Promise.all([
      getPreference('ambientSound', true),
      getPreference('quietMotion', false),
      getPreference('mojiCameos', true),
    ]);
    ['ambientSound', 'quietMotion', 'mojiCameos'].forEach((key, index) => {
      settingsWorld.querySelector(`[data-setting-toggle="${key}"]`)?.setAttribute('aria-checked', values[index] ? 'true' : 'false');
    });
    const user = authSession?.user;
    const displayName = user?.name || (authSession?.mode === 'local-guest' ? 'Local sanctuary pilgrim' : 'Miracle keeper');
    const email = user?.email || (authSession?.mode === 'local-guest' ? 'Stored on this device' : 'Account session');
    document.getElementById('settings-account-name').textContent = displayName;
    document.getElementById('settings-account-email').textContent = email;
    document.getElementById('settings-initials').textContent = initials(displayName);
    document.getElementById('settings-verify').hidden = !user;
    document.getElementById('settings-logout').hidden = !user;
    document.getElementById('settings-status').textContent = '';
    await notificationsUI.render();
    const rawBuild = document.querySelector('meta[name="miracle-build"]')?.content || '';
    const build = !rawBuild || rawBuild.startsWith('__') ? 'development' : rawBuild;
    document.getElementById('game-build-stamp').textContent = `Miracle Sanctuary build ${build}`;
  }

  async function applyStoredSettings() {
    const [ambientSound, quietMotion] = await Promise.all([
      getPreference('ambientSound', true),
      getPreference('quietMotion', false),
    ]);
    applySetting('ambientSound', ambientSound, false);
    applySetting('quietMotion', quietMotion, false);
  }

  function applySetting(key, enabled, fromUser) {
    if (key === 'ambientSound') {
      soundscape.setMuted?.(!enabled, fromUser);
      document.getElementById('sound-toggle').classList.toggle('is-muted', !enabled);
      document.getElementById('sound-toggle').setAttribute('aria-label', enabled ? 'Turn sound off' : 'Turn sound on');
    }
    if (key === 'quietMotion') world.setQuietMotion?.(enabled);
    if (key === 'mojiCameos' && !enabled) dismissMoji();
    if (fromUser) showToast(`${settingLabel(key)} ${enabled ? 'on' : 'off'}.`);
  }

  function bindNes() {
    document.getElementById('nes-form').addEventListener('submit', sendNesMessage);
    document.getElementById('nes-clear').addEventListener('click', () => {
      nesHistory = [];
      clearHistory();
      renderNes();
    });
  }

  function openNes() {
    openSpecial(nesWorld);
    renderNes();
    document.getElementById('nes-input').focus();
  }

  function renderNes(liveText = null) {
    const host = document.getElementById('nes-messages');
    host.innerHTML = nesHistory.length ? nesHistory.map(message => `<article class="nes-message is-${message.role}"><span>${message.role === 'assistant' ? 'Nes' : 'You'}</span><p>${esc(message.content)}</p></article>`).join('') : '<div class="nes-empty"><span class="lantern-core">' + icon('wand-sparkles', { size: 30 }) + '</span><p>Ask for help thinking, planning, searching your records, or deciding a next move.</p></div>';
    if (liveText != null) host.insertAdjacentHTML('beforeend', `<article class="nes-message is-assistant is-live"><span>Nes</span><p>${esc(liveText || 'Thinking...')}</p></article>`);
    host.scrollTop = host.scrollHeight;
  }

  async function sendNesMessage(event) {
    event.preventDefault();
    const input = document.getElementById('nes-input');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    const historyForRequest = nesHistory.slice(-18);
    nesHistory.push({ role: 'user', content: message });
    renderNes('');
    let full = '';
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      full = await streamChat(message, {
        history: historyForRequest,
        onDelta: delta => { full += delta; renderNes(full); },
          onToolCall: data => renderNes(`${full}\n\nWorking with ${labelize(data.name || 'the sanctuary')}...`),
        onError: data => { throw new Error(data.message || 'Nes could not answer.'); },
      });
      nesHistory.push({ role: 'assistant', content: full || 'I could not form an answer yet.' });
      saveHistory(nesHistory);
      renderNes();
    } catch (error) {
      if (!error.message.includes('authenticated')) console.error('[game] Nes failed', error);
      nesHistory.push({ role: 'assistant', content: error.message.includes('authenticated') ? 'Sign in first so I can safely work with your sanctuary.' : 'I could not reach the lantern just now. Your message was not saved as an activity.' });
      renderNes();
    } finally {
      submit.disabled = false;
    }
  }

  function bindTour() {
    document.getElementById('tour-next').addEventListener('click', () => {
      if (tourIndex >= tourSlides.length - 1) closeTour(true);
      else { tourIndex += 1; paintTour(); }
    });
    document.getElementById('tour-skip').addEventListener('click', () => closeTour(true));
  }

  function openTour() {
    closeDirectory();
    tourIndex = 0;
    welcomeTour.hidden = false;
    paintTour();
    document.getElementById('tour-next').focus();
  }

  function paintTour() {
    const slide = tourSlides[tourIndex];
    document.getElementById('tour-step').textContent = `${tourIndex + 1} of ${tourSlides.length}`;
    document.getElementById('tour-title').textContent = slide.title;
    document.getElementById('tour-copy').textContent = slide.copy;
    document.getElementById('tour-visual').innerHTML = icon(slide.icon, { size: 44, stroke: 1.2 });
    document.getElementById('tour-next').querySelector('span').textContent = tourIndex === tourSlides.length - 1 ? 'Begin' : 'Continue';
  }

  async function closeTour(remember) {
    welcomeTour.hidden = true;
    if (remember) await setPreference('tourComplete', true);
  }

  function scheduleMoji() {
    clearTimeout(mojiTimer);
    mojiTimer = window.setTimeout(() => showMoji('banner', 'Commit your work to the Lord, and your plans will be established. Proverbs 16:3'), 7000);
  }

  async function showMoji(action, message, { force = false } = {}) {
    if (!force && !await getPreference('mojiCameos', true)) return;
    const cfg = await getMojiConfig();
    if ((!force && cfg.popups === 'off') || !mojiCameo.hidden) return;
    document.getElementById('moji-character').innerHTML = renderBitmoji(cfg, { action });
    document.getElementById('moji-message').textContent = message;
    mojiCameo.dataset.action = action;
    mojiCameo.hidden = false;
    window.setTimeout(dismissMoji, 9000);
  }

  function dismissMoji() {
    mojiCameo.hidden = true;
  }

  async function refreshWorld(message) {
    const priorSigns = new Set((houseState?.signs || []).map(sign => sign.id));
    const nextState = await projectHouseState();
    const newSign = nextState.signs.find(sign => !priorSigns.has(sign.id));
    houseState = nextState;
    paintHouseGrowth();
    paintRoomGrowth();
    world.applyHouseGrowth?.(houseState);
    showToast(message);
    if (newSign) window.setTimeout(() => showAchievement(newSign), 420);
  }

  function showAchievement(sign) {
    achievementFocus = document.activeElement;
    document.getElementById('achievement-title').textContent = sign.label || 'Miracle Sign';
    document.getElementById('achievement-copy').textContent = sign.copy || signCopy(sign.sign);
    achievementReveal.hidden = false;
    soundscape.reward?.();
    pulseHaptic([10, 32, 12, 42, 16]);
    document.getElementById('achievement-close').focus();
  }

  function closeAchievement() {
    achievementReveal.hidden = true;
    achievementFocus?.focus?.();
  }
}

function hydrateStaticIcons() {
  document.querySelectorAll('[data-icon]').forEach(node => {
    node.innerHTML = icon(node.dataset.icon, { size: 18, stroke: 1.5 });
  });
}

function createFocusState(minutes = 25) {
  return {
    minutes,
    mode: minutes > 0 ? 'timed' : 'untimed',
    remaining: Math.max(0, minutes * 60),
    elapsed: 0,
    state: 'ready',
    startedAt: 0,
    lastTick: 0,
    interval: 0,
    saving: false,
    natural: false,
    reward: null,
    music: 'rain',
    rain: true,
  };
}

function isYouTubeFocusMusic(value) {
  return ['MvPgu-hwYQw', 'P-XnYn3FUq4'].includes(value);
}

function formatFocusDuration(seconds) {
  const rawSeconds = Math.max(0, Number(seconds || 0));
  const totalMinutes = Math.max(0, Math.round(rawSeconds / 60));
  if (rawSeconds > 0 && totalMinutes === 0) return '<1m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function renderLinkedFocusLog(record) {
  const sessions = Array.isArray(record?.focusLog) ? record.focusLog.slice(-5).reverse() : [];
  if (!sessions.length) return '';
  return `
    <section class="linked-focus-log" aria-label="Linked focus progress">
      <div><span>Focus progress</span><strong>${formatFocusDuration(record.focusSecondsTotal)} gathered</strong></div>
      ${sessions.map(session => `
        <article>
          <span>${esc(formatFocusDuration(session.elapsedSecs))}</span>
          <div>
            <strong>${esc(session.achievement || 'Focus session recorded')}</strong>
            ${session.milestone ? `<small>${esc(session.milestone)}</small>` : ''}
          </div>
          ${session.benchmarkPercent == null ? '' : `<b>${esc(session.benchmarkPercent)}%</b>`}
        </article>
      `).join('')}
    </section>
  `;
}

function displayValue(featureId, key, value) {
  if (featureId === 'daily' && key === 'gratitudeOne') return Array.isArray(value) ? value[0] || '' : value || '';
  if ((featureId === 'meals' && key === 'actualItems') || (featureId === 'dreams' && key === 'symbols')) return Array.isArray(value) ? value.join(', ') : value || '';
  if (typeof value === 'string' && value.includes('T') && value.endsWith('Z')) return value.slice(0, 16);
  return value;
}

function entryTitle(feature, row) {
  const value = row?.[feature.titleKey];
  if (Array.isArray(value)) return value.join(', ') || feature.name;
  return String(value || row?.title || row?.subject || row?.word || row?.memo || feature.name).slice(0, 180);
}

function entryMeta(feature, row) {
  const parts = [
    row.status || row.phase || row.type || row.slot || '',
    row.scheduledFor || row.date || row.startedOn || row.dreamDate || '',
    Number(row.focusSecondsTotal || 0) > 0 ? `${formatFocusDuration(row.focusSecondsTotal)} focus` : '',
    formatWhen(row.updatedAt || row.createdAt),
  ].filter(Boolean);
  return parts.map(labelize).join(' · ');
}

function recordKey(store, row) {
  return String(store === 'daily' || store === 'fti' ? row.date : store === 'meta' ? row.key : row.id);
}

function featureForStore(store) {
  const map = {
    daily: 'daily', events: 'schedule', prayers: 'prayer', bible: 'bible', fasts: 'fasting', prophecies: 'prophecy', testimonies: 'testimony', music: 'music', focusSessions: 'focus', tasks: 'tasks', ideas: 'ideas', plans: 'plans', projects: 'projects', blogs: 'blog', quizzes: 'quizzes', meals: 'meals', transactions: 'finance', people: 'people', books: 'books', dreams: 'dreams',
  };
  const feature = featureFor(map[store]);
  return feature ? [feature] : [];
}

function trashLabel(store, row) {
  const feature = featureForStore(store)[0];
  return feature ? entryTitle(feature, row) : String(row.title || row.name || row.subject || row.id || row.date || store);
}

function formatWhen(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso).slice(0, 10);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatPurge(iso) {
  if (!iso) return 'after 30 days';
  const days = Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

function labelize(value) {
  return String(value || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/^./, char => char.toUpperCase());
}

function normalizeMarks(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function markId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function mojiLineFor(room) {
  if (room === 'chapel') return 'Be still, and know that I am God. Psalm 46:10';
  if (room === 'workshop') return 'Small faithful work still builds something real.';
  if (room === 'garden') return 'Tending is progress too. Sip slowly.';
  return 'A life remembered becomes a light you can return to.';
}

function initials(name) {
  return String(name || 'M').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'M';
}

function settingLabel(key) {
  return { ambientSound: 'Living sound', quietMotion: 'Quiet motion', mojiCameos: 'Moji cameos' }[key] || 'Setting';
}

function signCopy(sign) {
  return {
    'first-light': 'You anchored, aimed, and attended before asking the day to perform.',
    'kept-word': 'Three promises were carried from intention into completion.',
    'deep-well': 'Three completed focus chambers deepened the Workshop.',
    watchfire: 'Five faithful records have kept the Chapel light burning.',
    'good-ground': 'Five acts of practical care have taken root in the Garden.',
    'golden-thread': 'Three illuminated pages or preserved dreams now form a thread you can follow.',
  }[sign] || 'A truthful pattern in your life has become visible.';
}
