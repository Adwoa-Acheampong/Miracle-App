import * as THREE from '../vendor/three.module.js';
import { icon } from './game-icons.js?v=__BUILD__';
import {
  initializeGameData,
  loadMorningState,
  saveMorningStep,
  awardFirstLight,
  projectHouseState,
  getPreference,
  setPreference,
} from './data.js?v=__BUILD__';
import { createHouseUI } from './house-ui.js?v=__BUILD__';
import { requireGameAuth } from './auth-ui.js?v=__BUILD__';
import { initGamePwa } from './pwa.js?v=__BUILD__';

const STEP_ORDER = ['anchor', 'aim', 'attend'];
const STEP_COPY = {
  anchor: {
    count: '1 of 3',
    title: 'Light the anchor',
    body: 'Begin with prayer or scripture.',
    button: 'Open anchor',
  },
  aim: {
    count: '2 of 3',
    title: 'Set the course',
    body: 'Choose the one thing that must move.',
    button: 'Open aim',
  },
  attend: {
    count: '3 of 3',
    title: 'Read the weather',
    body: 'Name how you are arriving today.',
    button: 'Open mood',
  },
};

const game = document.getElementById('game');
const sceneHost = document.getElementById('scene');
const gateIntro = document.getElementById('gate-intro');
const enterButton = document.getElementById('enter-button');
const sceneCommand = document.getElementById('scene-command');
const commandCount = document.getElementById('command-count');
const commandTitle = document.getElementById('command-title');
const commandBody = document.getElementById('command-body');
const objectCommand = document.getElementById('object-command');
const objectCommandLabel = document.getElementById('object-command-label');
const roomMap = document.getElementById('room-map');
const soundToggle = document.getElementById('sound-toggle');
const sheetBackdrop = document.getElementById('sheet-backdrop');
const rewardReveal = document.getElementById('reward-reveal');
const continueButton = document.getElementById('continue-button');
const toast = document.getElementById('toast');
const hudProgress = document.querySelector('.hud-progress');

document.querySelectorAll('[data-icon]').forEach(node => {
  node.innerHTML = icon(node.dataset.icon, { size: 18, stroke: 1.5 });
});

const systemReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
initGamePwa();
await initializeGameData();
let quietMotion = await getPreference('quietMotion', false);
let soundEnabled = await getPreference('ambientSound', true);
let state = await loadMorningState();
const authSession = await requireGameAuth({ showToast });
gateIntro.inert = false;
let activeSheet = null;
let lastFocus = null;
let selectedMood = state.entries.attend || null;
let toastTimer = 0;
let rewardTimer = 0;
let sparkTexture = null;
let houseUI = null;

const world = createWorld();
if (['127.0.0.1', 'localhost'].includes(location.hostname)) {
  window.__MIRACLE_GAME_DEBUG__ = world;
}
let soundscape = null;
syncWorldState(false);
renderMood();

enterButton.addEventListener('click', enterMorning);
objectCommand.addEventListener('click', () => {
  const step = currentStep();
  if (step) openSheet(step);
});
soundToggle.addEventListener('click', toggleSound);
continueButton.addEventListener('click', enterHouse);
sheetBackdrop.addEventListener('click', closeSheet);

document.querySelectorAll('[data-close-sheet]').forEach(button => {
  button.addEventListener('click', closeSheet);
});

document.querySelectorAll('[data-submit]').forEach(button => {
  button.addEventListener('click', () => submitStep(button.dataset.submit));
});

document.querySelectorAll('[data-mood]').forEach(button => {
  button.addEventListener('click', () => selectMood(button));
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && activeSheet) {
    closeSheet();
    return;
  }
  if (event.key === 'Tab' && activeSheet) trapSheetFocus(event);
});

window.addEventListener('resize', resizeGame, { passive: true });
window.visualViewport?.addEventListener('resize', resizeGame, { passive: true });

function resizeGame() {
  world.resize();
}

function currentStep() {
  return STEP_ORDER.find(step => !state.completed[step]) || null;
}

function isComplete() {
  return STEP_ORDER.every(step => state.completed[step]);
}

async function enterMorning() {
  enterButton.disabled = true;
  game.dataset.phase = 'opening';
  await soundscape.start();
  soundToggle.setAttribute('aria-label', soundscape.muted ? 'Turn sound on' : 'Turn sound off');
  soundscape.door();
  pulseHaptic([12, 38, 18]);
  await world.openGate();
  game.dataset.phase = 'atrium';
  gateIntro.hidden = true;
  document.querySelector('.hud').inert = false;
  syncWorldState(false);

  if (isComplete()) {
    sceneCommand.hidden = true;
    await enterHouse({ remembered: true });
    showToast('The house remembers this morning.');
  } else {
    sceneCommand.hidden = false;
    updateCommand();
  }
}

function openSheet(step) {
  if (!STEP_ORDER.includes(step) || state.completed[step]) return;
  const expected = currentStep();
  if (step !== expected) {
    showToast(`Complete ${STEP_COPY[expected].title.toLowerCase()} first.`);
    return;
  }

  const sheet = document.getElementById(`${step}-sheet`);
  lastFocus = document.activeElement;
  activeSheet = sheet;
  sheetBackdrop.hidden = false;
  sheet.hidden = false;
  sceneCommand.inert = true;
  document.querySelector('.hud').inert = true;

  if (step === 'anchor') {
    const input = document.getElementById('anchor-input');
    input.value = state.entries.anchor || '';
    requestAnimationFrame(() => input.focus());
  } else if (step === 'aim') {
    const input = document.getElementById('aim-input');
    input.value = state.entries.aim || '';
    requestAnimationFrame(() => input.focus());
  } else {
    selectedMood = state.entries.attend || null;
    renderMood();
    requestAnimationFrame(() => sheet.querySelector('[data-mood]')?.focus());
  }
}

function closeSheet() {
  if (!activeSheet) return;
  if (activeSheet.contains(document.activeElement)) document.activeElement.blur();
  activeSheet.hidden = true;
  sheetBackdrop.hidden = true;
  activeSheet = null;
  sceneCommand.inert = false;
  document.querySelector('.hud').inert = false;
  lastFocus?.focus?.({ preventScroll: true });
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    resizeGame();
  });
}

function trapSheetFocus(event) {
  const focusable = [...activeSheet.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled])')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function selectMood(button) {
  selectedMood = {
    word: button.dataset.mood,
    score: Number(button.dataset.score),
  };
  renderMood();
  document.getElementById('attend-error').textContent = '';
  pulseHaptic(7);
}

function renderMood() {
  const orbit = document.getElementById('mood-orbit');
  const value = document.getElementById('mood-value');
  const word = document.getElementById('mood-word');
  const score = selectedMood?.score;
  const valid = Number.isFinite(score);

  orbit.dataset.value = valid ? String(score) : 'none';
  orbit.style.setProperty('--mood-angle', valid ? `${Math.max(10, score * 3.6)}deg` : '0deg');
  value.textContent = valid ? String(score) : '--';
  word.textContent = valid ? selectedMood.word : 'unlogged';

  document.querySelectorAll('[data-mood]').forEach(button => {
    const checked = valid && button.dataset.mood === selectedMood.word;
    button.setAttribute('aria-checked', checked ? 'true' : 'false');
  });
}

async function submitStep(step) {
  let value;
  const error = document.getElementById(`${step}-error`);
  error.textContent = '';

  if (step === 'anchor') {
    value = document.getElementById('anchor-input').value.trim();
    if (!value) {
      error.textContent = 'Write a prayer before placing it.';
      document.getElementById('anchor-input').focus();
      return;
    }
  } else if (step === 'aim') {
    value = document.getElementById('aim-input').value.trim();
    if (!value) {
      error.textContent = 'Name the one thing that must move.';
      document.getElementById('aim-input').focus();
      return;
    }
  } else if (step === 'attend') {
    value = selectedMood;
    if (!value || !Number.isFinite(value.score)) {
      error.textContent = 'Choose the mood that is true right now.';
      return;
    }
  } else {
    return;
  }

  const submit = document.querySelector(`[data-submit="${step}"]`);
  submit.disabled = true;
  submit.classList.add('is-saving');
  try {
    await completeStep(step, value);
  } catch (saveError) {
    console.error('[game] morning save failed', saveError);
    error.textContent = 'The house could not save that yet. Please try again.';
  } finally {
    submit.disabled = false;
    submit.classList.remove('is-saving');
  }
}

async function completeStep(step, value) {
  if (state.completed[step] || step !== currentStep()) return;
  const saved = await saveMorningStep(step, value);
  state.entries[step] = value;
  state.completed[step] = true;
  state.sourceIds[step] = saved.id || saved.date;
  closeSheet();
  syncWorldState(true, step);
  soundscape.confirm(STEP_ORDER.indexOf(step));
  pulseHaptic([10, 24, 12]);
  showToast(`${step[0].toUpperCase()}${step.slice(1)} recorded. The house changed.`);

  if (isComplete()) {
    sceneCommand.hidden = true;
    const sign = await awardFirstLight();
    state.sign = sign ? 'first-light' : null;
    clearTimeout(rewardTimer);
    rewardTimer = window.setTimeout(revealReward, motionReduced() ? 20 : 850);
  } else {
    updateCommand();
  }
}

function syncWorldState(animate, justCompleted = null) {
  const completeCount = STEP_ORDER.filter(step => state.completed[step]).length;
  hudProgress.setAttribute('aria-label', `Morning ritual: ${completeCount} of three complete`);

  for (const step of STEP_ORDER) {
    document.querySelector(`[data-progress="${step}"]`)?.classList.toggle('is-complete', state.completed[step]);
  }

  world.applyState(state.completed, currentStep(), animate ? justCompleted : null);
  updateCommand();
}

function updateCommand() {
  const step = currentStep();
  if (!step) {
    sceneCommand.hidden = true;
    return;
  }
  const copy = STEP_COPY[step];
  commandCount.textContent = copy.count;
  commandTitle.textContent = copy.title;
  commandBody.textContent = copy.body;
  objectCommandLabel.textContent = copy.button;
}

function revealReward() {
  createRewardSparks();
  soundscape.reward();
  pulseHaptic([12, 34, 12, 34, 20]);
  rewardReveal.hidden = false;
  rewardReveal.querySelector('button').focus();
}

function createRewardSparks() {
  const field = rewardReveal.querySelector('.reward-sparks');
  field.replaceChildren();
  for (let i = 0; i < 34; i += 1) {
    const spark = document.createElement('i');
    spark.style.setProperty('--angle', `${(360 / 34) * i + Math.random() * 10}deg`);
    spark.style.setProperty('--distance', `${90 + Math.random() * 170}px`);
    spark.style.animationDelay = `${Math.random() * 180}ms`;
    field.appendChild(spark);
  }
}

async function enterHouse({ remembered = false } = {}) {
  rewardReveal.hidden = true;
  roomMap.hidden = true;
  game.dataset.phase = 'crossing';
  await world.enterAtriumHub?.();
  const house = await projectHouseState();
  world.applyHouseGrowth?.(house);
  game.dataset.phase = 'house';
  roomMap.hidden = false;
  await houseUI?.showHouse(house);
  const deepLink = new URLSearchParams(location.search).get('open');
  if (deepLink === 'rhythm') await houseUI?.openRhythm?.();
  if (deepLink === 'bible') await houseUI?.openBible?.();
  if (deepLink) history.replaceState(null, '', location.pathname);
  if (!remembered) showToast('Morning Gate complete. Choose the next room.');
}

async function toggleSound() {
  const muted = soundscape.toggle();
  soundEnabled = !muted;
  await setPreference('ambientSound', soundEnabled);
  soundToggle.classList.toggle('is-muted', muted);
  soundToggle.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  soundToggle.style.opacity = muted ? '0.55' : '1';
  showToast(muted ? 'Sound off' : 'Water and sound on');
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

function pulseHaptic(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

function motionReduced() {
  return systemReducedMotion || quietMotion;
}

function createWorld() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020603, 0.046);

  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 60);
  const cameraStart = new THREE.Vector3(0, 2.35, 9.4);
  const cameraInside = new THREE.Vector3(0, 2.62, 0.55);
  const cameraMorningThreshold = new THREE.Vector3(0, 2.35, -7.25);
  const targetStart = new THREE.Vector3(0, 2.15, 0.8);
  const targetInside = new THREE.Vector3(0, 1.38, -4.15);
  const cameraTarget = targetStart.clone();
  camera.position.copy(cameraStart);
  camera.lookAt(cameraTarget);

  const constrainedDevice = isConstrainedDevice();
  const renderer = new THREE.WebGLRenderer({ antialias: !constrainedDevice, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.34;
  renderer.setPixelRatio(renderPixelRatio(constrainedDevice, sceneHost.clientWidth, sceneHost.clientHeight));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('tabindex', '-1');
  sceneHost.appendChild(renderer.domElement);

  const ambient = new THREE.HemisphereLight(0x2f7f5d, 0x010201, 1.08);
  scene.add(ambient);

  const frontLight = new THREE.DirectionalLight(0x75dcb5, 1.25);
  frontLight.position.set(0, 5.5, 8);
  scene.add(frontLight);

  const entryLight = new THREE.PointLight(0x22d69a, 34, 18, 2);
  entryLight.position.set(0, 3.2, -0.4);
  scene.add(entryLight);

  const accentLight = new THREE.PointLight(0x2ad399, 18, 12, 2);
  accentLight.position.set(0, 5.4, -3.4);
  scene.add(accentLight);

  const floorMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x030806,
    roughness: 0.54,
    metalness: 0.28,
    clearcoat: 0.35,
    clearcoatRoughness: 0.48,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(22, 20), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -2.2);
  scene.add(floor);

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x030a07, roughness: 0.72, metalness: 0.14 });
  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x0a6f4f,
    emissive: 0x043d2a,
    emissiveIntensity: 0.22,
    roughness: 0.38,
    metalness: 0.72,
  });
  const emeraldMaterial = new THREE.MeshStandardMaterial({
    color: 0x075f44,
    emissive: 0x063d2e,
    emissiveIntensity: 0.22,
    roughness: 0.34,
    metalness: 0.28,
  });

  addArchitecture(scene, wallMaterial, trimMaterial, emeraldMaterial);
  const gate = createGate(scene, wallMaterial, trimMaterial);
  const water = createWater(scene);
  const interaction = createInteractionObjects(scene, trimMaterial);
  const atrium = createAtrium(scene, wallMaterial, trimMaterial, emeraldMaterial);
  const roomDoors = createRoomDoors(atrium.group, wallMaterial, trimMaterial);
  const houseRooms = createHouseRooms(scene, wallMaterial, trimMaterial, emeraldMaterial);
  atrium.group.visible = false;
  Object.values(houseRooms).forEach(room => { room.group.visible = false; });
  const ambientSparks = createAmbientSparks(scene);
  const transition = document.getElementById('scene-transition');

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const tweens = [];
  const bursts = [];
  let gateOpened = false;
  let currentRoom = null;
  let lastTime = performance.now();
  let renderActive = document.visibilityState === 'visible';
  let frameCount = 0;
  let frameWindowStarted = performance.now();
  let measuredFps = 60;

  renderer.domElement.addEventListener('pointerdown', event => {
    if (!['atrium', 'house'].includes(game.dataset.phase) || activeSheet || !rewardReveal.hidden) return;
    const step = hitTest(event);
    if (!step) return;
    if (step === currentStep()) openSheet(step);
    else if (!state.completed[step]) showToast(`Complete ${STEP_COPY[currentStep()].title.toLowerCase()} first.`);
  });

  renderer.domElement.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const step = hitTest(event);
    renderer.domElement.style.cursor = step && step === currentStep() ? 'pointer' : 'default';
  });

  function hitTest(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(interaction.hitboxes, false)[0]?.object.userData.step || null;
  }

  function resize() {
    const width = sceneHost.clientWidth;
    const height = sceneHost.clientHeight;
    camera.aspect = width / Math.max(1, height);
    camera.fov = width < 520 ? 58 : 36;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(renderPixelRatio(constrainedDevice, width, height));
    renderer.setSize(width, height, false);
    if (!tweens.length && game.dataset.phase === 'house') {
      if (currentRoom) {
        camera.position.copy(roomRestCamera(houseRooms[currentRoom]));
        cameraTarget.copy(houseRooms[currentRoom].target);
      } else {
        camera.position.copy(atriumRestCamera());
        cameraTarget.copy(atrium.target);
      }
    }
  }

  function atriumRestCamera() {
    if (sceneHost.clientWidth >= 520) return atrium.camera.clone();
    return atrium.group.position.clone().add(new THREE.Vector3(0, 2.82, 10.6));
  }

  function atriumEntryCamera() {
    if (sceneHost.clientWidth >= 520) return atrium.entranceCamera.clone();
    return atrium.group.position.clone().add(new THREE.Vector3(0, 2.82, 12.6));
  }

  function roomRestCamera(room) {
    if (sceneHost.clientWidth >= 520) return room.camera.clone();
    return room.group.position.clone().add(new THREE.Vector3(0, 3.05, 11.4));
  }

  function roomEntryCamera(room) {
    if (sceneHost.clientWidth >= 520) return room.entranceCamera.clone();
    return room.group.position.clone().add(new THREE.Vector3(0, 2.9, 13.4));
  }

  function tween(duration, update, easing = easeInOutCubic) {
    if (motionReduced() || duration <= 0) {
      update(1);
      return Promise.resolve();
    }
    return new Promise(resolve => {
      tweens.push({ started: performance.now(), duration, update, easing, resolve });
    });
  }

  async function openGate() {
    if (gateOpened) return;
    gateOpened = true;
    const fromLeft = gate.left.rotation.y;
    const fromRight = gate.right.rotation.y;
    const startCamera = camera.position.clone();
    const startTarget = cameraTarget.clone();
    await tween(1280, progress => {
      gate.left.rotation.y = THREE.MathUtils.lerp(fromLeft, 1.68, progress);
      gate.right.rotation.y = THREE.MathUtils.lerp(fromRight, -1.68, progress);
      camera.position.lerpVectors(startCamera, cameraInside, progress);
      cameraTarget.lerpVectors(startTarget, targetInside, progress);
      entryLight.intensity = THREE.MathUtils.lerp(34, 52, progress);
    });
  }

  async function enterAtriumHub() {
    const fromCamera = camera.position.clone();
    const fromTarget = cameraTarget.clone();
    await tween(620, progress => {
      camera.position.lerpVectors(fromCamera, cameraMorningThreshold, progress);
      cameraTarget.lerpVectors(fromTarget, new THREE.Vector3(0, 1.8, -10.5), progress);
    });
    await coverScene(true);
    atrium.group.visible = true;
    const entrance = atriumEntryCamera();
    camera.position.copy(entrance);
    cameraTarget.copy(atrium.target);
    interaction.hitboxes.forEach(hitbox => { hitbox.visible = false; });
    await coverScene(false);
    const arrival = atriumRestCamera();
    await tween(720, progress => {
      camera.position.lerpVectors(entrance, arrival, progress);
      cameraTarget.copy(atrium.target);
      atrium.light.intensity = THREE.MathUtils.lerp(12, 30, progress);
    });
  }

  function reset() {
    gateOpened = false;
    gate.left.rotation.y = 0;
    gate.right.rotation.y = 0;
    camera.position.copy(cameraStart);
    cameraTarget.copy(targetStart);
    entryLight.intensity = 34;
    atrium.group.visible = false;
    Object.values(houseRooms).forEach(room => { room.group.visible = false; });
    applyState({ anchor: false, aim: false, attend: false }, 'anchor');
  }

  function applyState(completed, activeStep, justCompleted = null) {
    for (const step of STEP_ORDER) {
      const item = interaction.objects[step];
      const done = completed[step];
      item.halo.userData.active = step === activeStep;
      item.halo.material.color.setHex(step === 'aim' ? 0x2ad399 : 0x18c58b);
      item.halo.material.opacity = step === activeStep ? 0.52 : 0;
      item.light.intensity = done ? (step === 'aim' ? 15 : 21) : (step === activeStep ? 10 : 0);
      item.coreMaterials.forEach(material => {
        material.emissiveIntensity = done ? 0.78 : (step === activeStep ? 0.36 : 0.08);
      });
      item.group.scale.setScalar(item.baseScale * (done ? 1.04 : 1));
    }

    const count = STEP_ORDER.filter(step => completed[step]).length;
    water.material.uniforms.uIntensity.value = 0.55 + count * 0.2;
    ambient.intensity = 1.08 + count * 0.12;
    accentLight.intensity = 18 + count * 3;
    roomDoors.forEach((door, index) => {
      door.glow.material.opacity = count === 3 ? 0.25 + index * 0.035 : 0.025;
      door.light.intensity = count === 3 ? 3.5 : 0;
    });

    if (justCompleted) {
      const item = interaction.objects[justCompleted];
      createBurst(item.group.position.clone().add(new THREE.Vector3(0, 1.05, 0)), justCompleted === 'aim' ? 0x2ad399 : 0x62efbd);
      const startScale = item.group.scale.x;
      tween(520, progress => {
        const pulse = Math.sin(progress * Math.PI) * 0.16;
        item.group.scale.setScalar(startScale + pulse);
      });
    }

    if (count === 3 && justCompleted) {
      createBurst(new THREE.Vector3(0, 2.2, -3.2), 0xdcfff2, 80);
    }

    if (game.dataset.phase === 'atrium') focusStep(activeStep);
  }

  function focusStep(step) {
    const targetX = step ? interaction.objects[step].group.position.x : 0;
    const fromCamera = camera.position.clone();
    const fromTarget = cameraTarget.clone();
    const toCamera = cameraInside.clone();
    const toTarget = targetInside.clone();
    toCamera.x = targetX * 0.12;
    toTarget.x = targetX * 0.46;
    tween(620, progress => {
      camera.position.lerpVectors(fromCamera, toCamera, progress);
      cameraTarget.lerpVectors(fromTarget, toTarget, progress);
    });
  }

  async function travelToRoom(roomId) {
    const destination = houseRooms[roomId];
    if (!destination) return;
    const doorIndex = ['chapel', 'workshop', 'garden', 'archive'].indexOf(roomId);
    const door = roomDoors[Math.max(0, doorIndex)];
    roomDoors.forEach(candidate => {
      candidate.panel.rotation.y = 0;
    });
    const doorPosition = door.frame.getWorldPosition(new THREE.Vector3());
    const fromCamera = camera.position.clone();
    const fromTarget = cameraTarget.clone();
    const doorCamera = new THREE.Vector3(doorPosition.x, 2.2, doorPosition.z + 3.25);
    const doorTarget = new THREE.Vector3(doorPosition.x, 1.7, doorPosition.z - 2.2);
    await tween(420, progress => {
      camera.position.lerpVectors(fromCamera, doorCamera, progress);
      cameraTarget.lerpVectors(fromTarget, doorTarget, progress);
      door.glow.material.opacity = THREE.MathUtils.lerp(0.28, 0.82, progress);
      door.panel.rotation.y = THREE.MathUtils.lerp(0, door.openAngle, progress);
    });
    const thresholdCamera = new THREE.Vector3(doorPosition.x, 2.15, doorPosition.z - 1.3);
    await tween(300, progress => {
      camera.position.lerpVectors(doorCamera, thresholdCamera, progress);
      cameraTarget.copy(doorTarget);
    });
    await coverScene(true);
    atrium.group.visible = false;
    Object.values(houseRooms).forEach(room => { room.group.visible = room === destination; });
    const roomStart = roomEntryCamera(destination);
    const roomArrival = roomRestCamera(destination);
    camera.position.copy(roomStart);
    cameraTarget.copy(destination.target);
    currentRoom = roomId;
    await coverScene(false);
    await tween(560, progress => {
      camera.position.lerpVectors(roomStart, roomArrival, progress);
      destination.light.intensity = THREE.MathUtils.lerp(8, 28 + destination.level * 3, progress);
    });
    destination.onEnter?.();
  }

  async function returnAtrium() {
    const fromCamera = camera.position.clone();
    const fromTarget = cameraTarget.clone();
    const room = currentRoom ? houseRooms[currentRoom] : null;
    const returnDoorIndex = ['chapel', 'workshop', 'garden', 'archive'].indexOf(currentRoom);
    const returnDoor = returnDoorIndex >= 0 ? roomDoors[returnDoorIndex] : null;
    const roomExit = room ? roomEntryCamera(room) : null;
    if (room) await tween(360, progress => {
      camera.position.lerpVectors(fromCamera, roomExit, progress);
      cameraTarget.lerpVectors(fromTarget, room.exitTarget, progress);
    });
    await coverScene(true);
    if (room) room.group.visible = false;
    atrium.group.visible = true;
    roomDoors.forEach(door => {
      door.panel.rotation.y = door === returnDoor ? door.openAngle : 0;
    });
    const atriumStart = atriumEntryCamera();
    camera.position.copy(atriumStart);
    cameraTarget.copy(atrium.target);
    currentRoom = null;
    await coverScene(false);
    const atriumArrival = atriumRestCamera();
    await tween(460, progress => {
      camera.position.lerpVectors(atriumStart, atriumArrival, progress);
      cameraTarget.copy(atrium.target);
      if (returnDoor) returnDoor.panel.rotation.y = THREE.MathUtils.lerp(returnDoor.openAngle, 0, progress);
    });
  }

  async function coverScene(covered) {
    if (!transition) return;
    const duration = motionReduced() ? 20 : 150;
    transition.hidden = false;
    transition.getBoundingClientRect();
    transition.classList.toggle('is-visible', covered);
    await new Promise(resolve => window.setTimeout(resolve, duration));
    if (!covered) transition.hidden = true;
  }

  function applyHouseGrowth(house) {
    for (const [roomId, destination] of Object.entries(houseRooms)) {
      const growth = house?.rooms?.[roomId] || { level: 0, progress: 0 };
      destination.level = growth.level;
      destination.growth.visible = true;
      destination.light.intensity = 18 + growth.level * 4;
      destination.applyState?.(growth);
    }
  }

  function celebrateRoom(roomId) {
    const destination = houseRooms[roomId];
    if (!destination) return;
    createBurst(destination.target.clone().add(new THREE.Vector3(0, 1.6, 0.4)), 0xdcfff2, 48);
    tween(620, progress => {
      destination.light.intensity += Math.sin(progress * Math.PI) * 18;
    });
  }

  function createBurst(origin, color, count = 34) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const p = i * 3;
      positions[p] = origin.x;
      positions[p + 1] = origin.y;
      positions[p + 2] = origin.z;
      const direction = new THREE.Vector3(
        (Math.random() - 0.5) * 1.8,
        0.45 + Math.random() * 1.4,
        (Math.random() - 0.5) * 1.8,
      );
      velocities[p] = direction.x;
      velocities[p + 1] = direction.y;
      velocities[p + 2] = direction.z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: 0.09,
      map: makeSparkTexture(),
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);
    bursts.push({ points, velocities, age: 0, duration: 1.55 });
  }

  function frame(time) {
    if (!renderActive) return;
    const delta = Math.min(0.04, Math.max(0.001, (time - lastTime) / 1000));
    lastTime = time;

    water.material.uniforms.uTime.value = time / 1000;
    ambientSparks.rotation.y = Math.sin(time * 0.00008) * 0.06;
    ambientSparks.position.y = Math.sin(time * 0.00025) * 0.08;

    for (const [roomId, room] of Object.entries(houseRooms)) {
      if (!motionReduced() && currentRoom === roomId) {
        room.tick?.(time);
      }
      room.halo.material.opacity = currentRoom === roomId
        ? 0.14 + (Math.sin(time * 0.0022) + 1) * 0.08
        : 0.05;
    }

    for (const step of STEP_ORDER) {
      const item = interaction.objects[step];
      const active = item.halo.userData.active;
      if (active && !motionReduced()) {
        const wave = (Math.sin(time * 0.0032) + 1) / 2;
        const pause = (Math.sin(time * 0.00082) + 1) / 2;
        item.halo.material.opacity = pause > 0.42 ? 0.2 + wave * 0.42 : 0.08;
        item.halo.scale.setScalar(0.94 + wave * 0.12);
        item.group.rotation.y = Math.sin(time * 0.0007 + STEP_ORDER.indexOf(step)) * 0.035;
      } else if (!active) {
        item.halo.material.opacity = 0;
      }
    }

    for (let i = tweens.length - 1; i >= 0; i -= 1) {
      const item = tweens[i];
      const raw = Math.min(1, (time - item.started) / item.duration);
      item.update(item.easing(raw));
      if (raw >= 1) {
        tweens.splice(i, 1);
        item.resolve();
      }
    }

    for (let i = bursts.length - 1; i >= 0; i -= 1) {
      const burst = bursts[i];
      burst.age += delta;
      const positions = burst.points.geometry.attributes.position.array;
      for (let j = 0; j < positions.length; j += 3) {
        positions[j] += burst.velocities[j] * delta;
        positions[j + 1] += burst.velocities[j + 1] * delta;
        positions[j + 2] += burst.velocities[j + 2] * delta;
        burst.velocities[j + 1] -= 0.42 * delta;
      }
      burst.points.geometry.attributes.position.needsUpdate = true;
      burst.points.material.opacity = Math.max(0, 1 - burst.age / burst.duration);
      if (burst.age >= burst.duration) {
        scene.remove(burst.points);
        burst.points.geometry.dispose();
        burst.points.material.dispose();
        bursts.splice(i, 1);
      }
    }

    camera.lookAt(cameraTarget);
    renderer.render(scene, camera);
    frameCount += 1;
    if (time - frameWindowStarted >= 1000) {
      measuredFps = Math.round((frameCount * 1000) / (time - frameWindowStarted));
      frameCount = 0;
      frameWindowStarted = time;
    }
  }

  resize();
  renderer.setAnimationLoop(frame);
  document.addEventListener('visibilitychange', () => {
    renderActive = document.visibilityState === 'visible';
    lastTime = performance.now();
    if (renderActive) renderer.render(scene, camera);
  });

  function setQuietMotion(enabled) {
    quietMotion = !!enabled;
    game.dataset.quietMotion = quietMotion ? 'true' : 'false';
  }

  function canvasPixelStats() {
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let litPixels = 0;
    let sampledPixels = 0;
    const stride = Math.max(4, Math.floor(pixels.length / 16000 / 4) * 4);
    for (let index = 0; index < pixels.length; index += stride) {
      sampledPixels += 1;
      if (pixels[index] + pixels[index + 1] + pixels[index + 2] > 12) litPixels += 1;
    }
    return { width, height, sampledPixels, litPixels };
  }

  setQuietMotion(quietMotion);
  return { openGate, enterAtriumHub, applyState, applyHouseGrowth, travelToRoom, returnAtrium, celebrateRoom, setQuietMotion, canvasPixelStats, resize, reset, renderer, scene, camera, performanceStats: () => ({ fps: measuredFps, pixelRatio: renderer.getPixelRatio(), constrainedDevice }) };
}

function isConstrainedDevice() {
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const smallScreen = Math.min(window.screen.width, window.screen.height) < 720;
  const limitedMemory = Number(navigator.deviceMemory || 8) <= 4;
  const limitedCores = Number(navigator.hardwareConcurrency || 8) <= 4;
  return (coarsePointer && smallScreen) || limitedMemory || limitedCores;
}

function renderPixelRatio(constrained, width = window.innerWidth, height = window.innerHeight) {
  const cap = constrained || window.innerWidth < 700 ? 1.25 : 1.5;
  const baseRatio = Math.min(window.devicePixelRatio || 1, cap);
  if (!constrained || width < 700) return baseRatio;
  const adaptiveRatio = Math.sqrt(820000 / Math.max(1, width * height));
  return Math.max(0.72, Math.min(baseRatio, adaptiveRatio));
}

function createAtrium(scene, wallMaterial, trimMaterial, emeraldMaterial) {
  const group = new THREE.Group();
  group.position.set(0, 0, -22);
  scene.add(group);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(7.1, 48),
    new THREE.MeshStandardMaterial({ color: 0x020705, roughness: 0.54, metalness: 0.3 }),
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(5.8, 5.86, 64), trimMaterial.clone());
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = 0.025;
  group.add(floorRing);

  const rear = new THREE.Mesh(new THREE.BoxGeometry(14.8, 6.6, 0.38), wallMaterial.clone());
  rear.position.set(0, 3.2, -5.55);
  group.add(rear);
  for (const x of [-6.25, 6.25]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 6.2, 7.5), wallMaterial.clone());
    wing.position.set(x, 3.05, -1.8);
    group.add(wing);
  }

  const pool = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.72, 0.22, 48), wallMaterial.clone());
  basin.position.y = 0.11;
  pool.add(basin);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1.42, 48),
    new THREE.MeshStandardMaterial({ color: 0x0a8a62, emissive: 0x075f44, emissiveIntensity: 0.5, transparent: true, opacity: 0.78, roughness: 0.22 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.235;
  pool.add(water);
  const poolRim = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.055, 10, 64), trimMaterial.clone());
  poolRim.rotation.x = Math.PI / 2;
  poolRim.position.y = 0.25;
  pool.add(poolRim);
  for (const [radius, height] of [[0.72, 0.72], [0.51, 0.98], [0.31, 1.22]]) {
    const ripple = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.032, 8, 48), emeraldMaterial.clone());
    ripple.position.y = height;
    ripple.rotation.x = Math.PI / 2;
    pool.add(ripple);
  }
  const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 1), trimMaterial.clone());
  drop.position.y = 1.9;
  pool.add(drop);
  group.add(pool);

  for (const x of [-5.75, 5.75]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.28, 5.5, 12), wallMaterial.clone());
    column.position.set(x, 2.75, -4.95);
    group.add(column);
    const capital = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 8, 24), trimMaterial.clone());
    capital.rotation.x = Math.PI / 2;
    capital.position.set(x, 5.18, -4.95);
    group.add(capital);
  }
  const light = new THREE.PointLight(0x44e3ad, 30, 18, 2);
  light.position.set(0, 4.6, 1.1);
  group.add(light);
  return {
    group,
    light,
    camera: group.position.clone().add(new THREE.Vector3(0, 2.72, 8.25)),
    entranceCamera: group.position.clone().add(new THREE.Vector3(0, 2.7, 10.1)),
    target: group.position.clone().add(new THREE.Vector3(0, 1.7, -2.1)),
  };
}

function createHouseRooms(scene, wallMaterial, trimMaterial, emeraldMaterial) {
  const centers = {
    chapel: new THREE.Vector3(-27, 0, -48),
    workshop: new THREE.Vector3(-9, 0, -48),
    garden: new THREE.Vector3(9, 0, -48),
    archive: new THREE.Vector3(27, 0, -48),
  };
  const builders = { chapel: buildChapelRoom, workshop: buildWorkshopRoom, garden: buildGardenRoom, archive: buildArchiveRoom };
  return Object.fromEntries(Object.entries(centers).map(([roomId, center], index) => {
    const group = new THREE.Group();
    group.position.copy(center);
    scene.add(group);
    const built = builders[roomId](group, wallMaterial, trimMaterial, emeraldMaterial);
    return [roomId, {
      group,
      ...built,
      level: 0,
      seed: index * 1.7,
      camera: center.clone().add(built.cameraOffset || new THREE.Vector3(0, 3, 8.2)),
      entranceCamera: center.clone().add(built.entranceOffset || new THREE.Vector3(0, 2.65, 10.8)),
      target: center.clone().add(built.targetOffset || new THREE.Vector3(0, 1.7, -0.9)),
      exitTarget: center.clone().add(new THREE.Vector3(0, 1.8, 12.5)),
    }];
  }));
}

function buildChapelRoom(group, wallMaterial, trimMaterial, emeraldMaterial) {
  addRoomBox(group, { width: 11.8, depth: 14, wallMaterial, floorMaterial: new THREE.MeshStandardMaterial({ color: 0x020604, roughness: 0.84 }) });
  const aisle = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 12), new THREE.MeshStandardMaterial({ color: 0x04120c, roughness: 0.72 }));
  aisle.rotation.x = -Math.PI / 2;
  aisle.position.set(0, 0.018, -0.5);
  group.add(aisle);
  for (const z of [2.8, 0.9, -1]) {
    for (const x of [-3.2, 3.2]) {
      const pew = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 0.72), wallMaterial.clone());
      pew.position.set(x, 0.72, z);
      group.add(pew);
      const back = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.05, 0.16), wallMaterial.clone());
      back.position.set(x, 1.2, z - 0.31);
      group.add(back);
    }
  }
  const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x6ff7c5, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
  for (const x of [-3.6, 0, 3.6]) {
    const window = new THREE.Mesh(new THREE.CircleGeometry(0.82, 32, 0, Math.PI), windowMaterial.clone());
    window.position.set(x, 4.15, -6.8);
    group.add(window);
    const stem = new THREE.Mesh(new THREE.PlaneGeometry(1.64, 2.15), windowMaterial.clone());
    stem.position.set(x, 3.08, -6.8);
    group.add(stem);
  }
  for (const x of [-5.1, 5.1]) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.055, 8, 42, Math.PI), trimMaterial.clone());
    rib.position.set(x, 3.4, -1.3);
    rib.rotation.y = Math.PI / 2;
    group.add(rib);
  }
  const altar = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.05, 1.4), new THREE.MeshPhysicalMaterial({ color: 0x04150e, roughness: 0.46, clearcoat: 0.32 }));
  altar.position.set(0, 0.54, -4.7);
  group.add(altar);

  const livingLamp = new THREE.Group();
  livingLamp.position.set(0, 1.08, -4.7);
  group.add(livingLamp);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.48, 0.32, 28), trimMaterial.clone());
  bowl.position.y = 0.18;
  livingLamp.add(bowl);
  const lampColors = [0x0d8b64, 0x17b883, 0x36d9a1, 0x74efc1, 0xb8ffe4, 0x087553];
  const flames = lampColors.map((color, index) => {
    const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.04, roughness: 0.2 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.62 + (index % 2) * 0.16, 16), material);
    const angle = (index / lampColors.length) * Math.PI * 2;
    flame.position.set(Math.cos(angle) * 0.42, 0.72 + (index % 2) * 0.08, Math.sin(angle) * 0.27);
    flame.visible = false;
    livingLamp.add(flame);
    return flame;
  });
  const lampLight = new THREE.PointLight(0x8af7cf, 0, 8, 2);
  lampLight.position.set(0, 1.1, 0.3);
  livingLamp.add(lampLight);
  const halo = makeRoomHalo(group, 0x42e4ad, new THREE.Vector3(0, 3.2, -6.78), 3.2);
  const light = new THREE.PointLight(0x42e4ad, 18, 15, 2);
  light.position.set(0, 4.5, 0);
  group.add(light);
  const orbit = new THREE.Group();
  group.add(orbit);
  return {
    halo, orbit, growth: livingLamp, light,
    applyState(growth) {
      const counts = growth.counts || {};
      const recordCounts = [counts.prayers, counts.bible, counts.prophecies, counts.testimonies, counts.fasts, counts.music];
      const active = recordCounts.map(value => Number(value || 0) > 0);
      flames.forEach((flame, index) => {
        flame.visible = active[index];
        flame.material.emissiveIntensity = active[index] ? 1.15 + Math.min(1.2, Number(recordCounts[index]) * 0.12) : 0.04;
      });
      const activeCount = active.filter(Boolean).length;
      lampLight.intensity = activeCount ? 18 + activeCount * 6 : 0;
      livingLamp.scale.setScalar(0.92 + Math.min(0.18, Number(growth.level || 0) * 0.045));
    },
    tick(time) {
      flames.forEach((flame, index) => {
        if (flame.visible) flame.scale.y = 0.9 + Math.sin(time * 0.004 + index) * 0.12;
      });
    },
  };
}

function buildWorkshopRoom(group, wallMaterial, trimMaterial) {
  addRoomBox(group, { width: 13.4, depth: 11.8, wallMaterial, floorMaterial: new THREE.MeshStandardMaterial({ color: 0x030907, roughness: 0.58, metalness: 0.28 }) });
  const benchMaterial = new THREE.MeshStandardMaterial({ color: 0x073426, emissive: 0x043122, emissiveIntensity: 0.38, roughness: 0.42, metalness: 0.48 });
  const bench = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.38, 2.2), benchMaterial);
  bench.position.set(0, 1.35, -1.6);
  group.add(bench);
  const benchEdge = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.055, 0.055), trimMaterial.clone());
  benchEdge.position.set(0, 1.55, -0.48);
  group.add(benchEdge);
  for (const x of [-2.8, 2.8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.35, 1.55), benchMaterial);
    leg.position.set(x, 0.68, -1.6);
    group.add(leg);
  }
  const boardMaterial = wallMaterial.clone();
  boardMaterial.color.setHex(0x041a12);
  boardMaterial.emissive.setHex(0x03140e);
  boardMaterial.emissiveIntensity = 0.3;
  const projectWall = new THREE.Mesh(new THREE.BoxGeometry(8.2, 3.7, 0.18), boardMaterial);
  projectWall.position.set(0, 3.5, -5.72);
  group.add(projectWall);
  const workOrders = [];
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const order = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.95), new THREE.MeshStandardMaterial({ color: 0x0a3d2d, emissive: 0x18c58b, emissiveIntensity: 0.15, side: THREE.DoubleSide }));
      order.position.set(-2.55 + col * 1.7, 4.3 - row * 1.25, -5.61);
      group.add(order);
      workOrders.push(order);
    }
  }
  const forge = new THREE.Group();
  forge.position.set(-3.8, 0, -3.4);
  group.add(forge);
  const forgeBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.5, 1.8), wallMaterial.clone());
  forgeBody.position.y = 1.25;
  forge.add(forgeBody);
  const forgeCoreMaterial = new THREE.MeshBasicMaterial({ color: 0x16a678, transparent: true, opacity: 0.18 });
  const forgeCore = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.25), forgeCoreMaterial);
  forgeCore.position.set(0, 1.2, 0.92);
  forge.add(forgeCore);
  const focusClock = new THREE.Group();
  focusClock.position.set(3.9, 2.55, -5.55);
  const clockRing = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.09, 10, 48), trimMaterial.clone());
  focusClock.add(clockRing);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.72, 0.05), trimMaterial.clone());
  hand.position.y = 0.32;
  focusClock.add(hand);
  group.add(focusClock);
  for (const x of [-2.15, -0.72, 0.72, 2.15]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.055, 0.055), trimMaterial.clone());
    rail.position.set(x, 2.1, -0.42);
    rail.rotation.z = x < 0 ? -0.28 : 0.28;
    group.add(rail);
    const tool = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 7, 20), trimMaterial.clone());
    tool.position.set(x, 1.84, -0.4);
    group.add(tool);
  }
  for (const x of [-4.2, 0, 4.2]) {
    const floorTrack = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.025, 0.07), trimMaterial.clone());
    floorTrack.position.set(x, 0.03, 2.8);
    group.add(floorTrack);
  }
  const growth = new THREE.Group();
  growth.add(...workOrders);
  group.add(growth);
  const halo = makeRoomHalo(group, 0x1bb883, new THREE.Vector3(0, 3.4, -5.68), 3.8);
  const light = new THREE.PointLight(0x2ad399, 36, 17, 2);
  light.position.set(0, 4.2, 2.2);
  group.add(light);
  return {
    halo, orbit: focusClock, growth, light,
    applyState(state) {
      const completed = Number(state.completed || 0);
      workOrders.forEach((order, index) => { order.material.emissiveIntensity = index < completed ? 0.82 : 0.15; });
      forgeCoreMaterial.opacity = completed ? Math.min(0.78, 0.18 + completed * 0.08) : 0.12;
    },
    tick(time) { hand.rotation.z = -time * 0.00018; forgeCoreMaterial.opacity += Math.sin(time * 0.003) * 0.0008; },
    cameraOffset: new THREE.Vector3(0.8, 3.1, 8.4),
  };
}

function buildGardenRoom(group, wallMaterial, trimMaterial) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(14.5, 15.5), new THREE.MeshStandardMaterial({ color: 0x03120c, roughness: 0.96 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -0.6;
  group.add(ground);
  const pathMaterial = new THREE.MeshStandardMaterial({ color: 0x071d15, roughness: 0.9 });
  for (let i = 0; i < 8; i += 1) {
    const stone = new THREE.Mesh(new THREE.BoxGeometry(1.5 + (i % 2) * 0.2, 0.08, 1.15, 1, 1, 1), pathMaterial);
    stone.position.set(Math.sin(i * 0.85) * 0.4, 0.04, 5 - i * 1.35);
    stone.rotation.y = Math.sin(i) * 0.16;
    group.add(stone);
  }
  const plantGroups = [];
  for (const [bedIndex, x] of [-3.5, 3.5].entries()) {
    for (let row = 0; row < 2; row += 1) {
      const z = 1.4 - row * 4.1;
      const bed = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.34, 3), new THREE.MeshStandardMaterial({ color: 0x04150e, roughness: 0.92 }));
      bed.position.set(x, 0.17, z);
      group.add(bed);
      const plants = new THREE.Group();
      plants.position.set(x, 0.32, z);
      group.add(plants);
      for (let p = 0; p < 5; p += 1) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.8, 8), trimMaterial.clone());
        stem.position.set(-1.05 + (p % 3) * 1.02, 0.4, -0.72 + Math.floor(p / 3) * 1.42);
        plants.add(stem);
        const leafMaterial = new THREE.MeshStandardMaterial({ color: bedIndex ? 0x0a8a62 : 0x087a58, emissive: 0x075f44, emissiveIntensity: 0.18, roughness: 0.7 });
        for (const side of [-1, 1]) {
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), leafMaterial);
          leaf.scale.set(1.55, 0.48, 0.78);
          leaf.rotation.z = side * 0.52;
          leaf.position.copy(stem.position).add(new THREE.Vector3(side * 0.17, 0.45, 0));
          plants.add(leaf);
        }
        const bud = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), trimMaterial.clone());
        bud.position.copy(stem.position).add(new THREE.Vector3(0, 0.86, 0));
        plants.add(bud);
      }
      plants.scale.y = 0.38;
      plantGroups.push(plants);
    }
  }
  for (const x of [-6.2, 6.2]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.45, 3.4, 10), wallMaterial.clone());
    trunk.position.set(x, 1.7, -3.7);
    group.add(trunk);
    const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x075f44, emissive: 0x043d2a, emissiveIntensity: 0.2, roughness: 0.8 });
    for (const [dx, dy] of [[0, 0], [-0.62, -0.25], [0.62, -0.18], [0, 0.7]]) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.82, 1), crownMaterial);
      crown.position.set(x + dx, 3.95 + dy, -3.7);
      group.add(crown);
    }
  }
  const trellisMaterial = trimMaterial.clone();
  for (const x of [-3.8, -1.9, 0, 1.9, 3.8]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 4.2, 8), trellisMaterial);
    post.position.set(x, 2.1, -6.75);
    group.add(post);
  }
  for (const y of [1.2, 2.25, 3.3, 4.2]) {
    const vine = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.045, 0.05), trellisMaterial);
    vine.position.set(0, y, -6.72);
    group.add(vine);
  }
  const vineLeafMaterial = new THREE.MeshStandardMaterial({ color: 0x087a58, emissive: 0x043d2a, emissiveIntensity: 0.22, roughness: 0.74 });
  for (let index = 0; index < 18; index += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), vineLeafMaterial);
    leaf.scale.set(1.7, 0.55, 0.7);
    leaf.rotation.z = (index % 2 ? 1 : -1) * 0.46;
    leaf.position.set(-3.75 + (index % 6) * 1.5, 1.15 + Math.floor(index / 6) * 1.25, -6.63);
    group.add(leaf);
  }
  const gardenGlow = new THREE.Mesh(new THREE.PlaneGeometry(8.1, 3.75), new THREE.MeshBasicMaterial({ color: 0x0a8a62, transparent: true, opacity: 0.055, depthWrite: false }));
  gardenGlow.position.set(0, 2.35, -6.8);
  group.add(gardenGlow);
  const waterChannel = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 13.2), new THREE.MeshBasicMaterial({ color: 0x20c58d, transparent: true, opacity: 0.34 }));
  waterChannel.rotation.x = -Math.PI / 2;
  waterChannel.position.set(0, 0.065, -0.3);
  group.add(waterChannel);
  const halo = makeRoomHalo(group, 0x25cf93, new THREE.Vector3(0, 3.1, -7.25), 4.2);
  const light = new THREE.HemisphereLight(0x75dcb5, 0x020604, 2.2);
  group.add(light);
  const growth = new THREE.Group();
  plantGroups.forEach(item => growth.add(item));
  group.add(growth);
  return {
    halo, orbit: new THREE.Group(), growth, light,
    applyState(state) {
      const scale = 0.38 + Math.min(0.62, Number(state.count || 0) / 22);
      plantGroups.forEach((plants, index) => { plants.scale.y = Math.max(0.34, scale - index * 0.035); });
    },
    tick(time) { plantGroups.forEach((plants, index) => { plants.rotation.z = Math.sin(time * 0.0007 + index) * 0.018; }); },
    cameraOffset: new THREE.Vector3(0, 2.75, 9.2),
    targetOffset: new THREE.Vector3(0, 1.5, -2.2),
  };
}

function buildArchiveRoom(group, wallMaterial, trimMaterial) {
  addRoomBox(group, { width: 13.8, depth: 12.6, wallMaterial, floorMaterial: new THREE.MeshStandardMaterial({ color: 0x020604, roughness: 0.66, metalness: 0.16 }) });
  const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x052018, roughness: 0.64, metalness: 0.22 });
  const shelfBooks = [];
  for (const x of [-4.9, 4.9]) {
    for (let row = 0; row < 4; row += 1) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.72), trimMaterial.clone());
      shelf.position.set(x, 1.25 + row * 1.15, -5.6);
      group.add(shelf);
      for (let b = 0; b < 7; b += 1) {
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.72, 0.5), shelfMaterial.clone());
        book.position.set(x - 0.92 + b * 0.31, 1.66 + row * 1.15, -5.48);
        group.add(book);
        shelfBooks.push(book);
      }
    }
  }
  const desk = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.42, 3.2), shelfMaterial);
  desk.position.set(0, 1.12, -1.1);
  group.add(desk);
  for (const x of [-2.2, 2.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.2, 2.25), shelfMaterial);
    leg.position.set(x, 0.58, -1.1);
    group.add(leg);
  }
  const book = createThreeBook(trimMaterial);
  book.group.position.set(0, 2.16, -0.72);
  book.group.rotation.x = 0.48;
  book.group.scale.setScalar(1.12);
  group.add(book.group);
  const halo = makeRoomHalo(group, 0x67edbd, new THREE.Vector3(0, 3.3, -6.18), 3.6);
  const light = new THREE.PointLight(0xbaffdf, 22, 14, 2);
  light.position.set(0, 4.6, 0.5);
  group.add(light);
  const growth = new THREE.Group();
  shelfBooks.forEach(item => growth.add(item));
  group.add(growth);
  let pageTurnStarted = 0;
  return {
    halo, orbit: book.binding, growth, light,
    applyState(state) {
      const lit = Math.min(shelfBooks.length, Number(state.count || 0));
      shelfBooks.forEach((item, index) => { item.material.emissive.setHex(index < lit ? 0x0a6f4f : 0x000000); item.material.emissiveIntensity = index < lit ? 0.36 : 0; });
    },
    onEnter() { pageTurnStarted = performance.now(); },
    tick(time) {
      if (!pageTurnStarted) return;
      const phase = ((time - pageTurnStarted) % 5200) / 5200;
      if (phase < 0.42) book.turningPage.rotation.z = -Math.PI * easeInOutCubic(phase / 0.42);
      else if (phase < 0.7) book.turningPage.rotation.z = -Math.PI;
      else book.turningPage.rotation.z = -Math.PI * (1 - easeInOutCubic((phase - 0.7) / 0.3));
    },
    cameraOffset: new THREE.Vector3(0, 3.25, 8.6),
    targetOffset: new THREE.Vector3(0, 1.55, -1.2),
  };
}

function addRoomBox(group, { width, depth, wallMaterial, floorMaterial }) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -0.6;
  group.add(floor);
  const rear = new THREE.Mesh(new THREE.BoxGeometry(width, 6.5, 0.34), wallMaterial.clone());
  rear.position.set(0, 3.2, -depth / 2);
  group.add(rear);
  for (const x of [-width / 2, width / 2]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.34, 6.2, depth), wallMaterial.clone());
    side.position.set(x, 3.05, -0.6);
    group.add(side);
  }
}

function makeRoomHalo(group, color, position, radius) {
  const halo = new THREE.Mesh(new THREE.RingGeometry(radius * 0.9, radius, 56), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }));
  halo.position.copy(position);
  halo.visible = false;
  group.add(halo);
  return halo;
}

function createThreeBook(trimMaterial) {
  const group = new THREE.Group();
  const pageMaterial = new THREE.MeshStandardMaterial({ color: 0xc9f8e6, emissive: 0x075f44, emissiveIntensity: 0.1, roughness: 0.78, side: THREE.DoubleSide });
  const coverMaterial = new THREE.MeshStandardMaterial({ color: 0x03120c, roughness: 0.48, metalness: 0.2 });
  const cover = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.16, 3.1), coverMaterial);
  group.add(cover);
  const leftPage = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 2.72), pageMaterial.clone());
  leftPage.rotation.x = -Math.PI / 2;
  leftPage.position.set(-1.08, 0.13, 0);
  group.add(leftPage);
  const rightPage = leftPage.clone();
  rightPage.position.x = 1.08;
  group.add(rightPage);
  const binding = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 2.8, 12), trimMaterial.clone());
  binding.rotation.x = Math.PI / 2;
  binding.position.y = 0.16;
  group.add(binding);
  const inkMaterial = new THREE.MeshBasicMaterial({ color: 0x075f44 });
  for (const x of [-1.08, 1.08]) {
    for (let line = 0; line < 5; line += 1) {
      const ink = new THREE.Mesh(new THREE.BoxGeometry(1.45 - (line % 2) * 0.28, 0.014, 0.035), inkMaterial);
      ink.position.set(x, 0.147, -0.78 + line * 0.38);
      group.add(ink);
    }
  }
  const turningPage = new THREE.Group();
  turningPage.position.set(0, 0.16, 1.36);
  const leaf = new THREE.Mesh(new THREE.PlaneGeometry(2.08, 2.66), pageMaterial.clone());
  leaf.rotation.x = -Math.PI / 2;
  leaf.position.set(1.04, 0, -1.33);
  turningPage.add(leaf);
  group.add(turningPage);
  return { group, binding, turningPage };
}

function addArchitecture(scene, wallMaterial, trimMaterial, emeraldMaterial) {
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(14, 7, 0.45), wallMaterial);
  backWall.position.set(0, 3.1, -6.2);
  scene.add(backWall);

  const ceilingBeam = new THREE.Mesh(new THREE.BoxGeometry(13.5, 0.24, 0.34), trimMaterial);
  ceilingBeam.position.set(0, 5.9, -5.9);
  scene.add(ceilingBeam);

  for (const x of [-5.4, -3.05, 3.05, 5.4]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.33, 5.8, 10), wallMaterial);
    column.position.set(x, 2.9, -3.2);
    scene.add(column);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.05, 12), trimMaterial);
    line.position.set(x, 5.3, -3.2);
    scene.add(line);
  }

  const canopy = new THREE.Mesh(new THREE.RingGeometry(2.7, 2.86, 64, 1, 0, Math.PI), trimMaterial);
  canopy.position.set(0, 3.55, -5.94);
  scene.add(canopy);

  const windowGlow = new THREE.Mesh(
    new THREE.CircleGeometry(2.62, 64, 0, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x0a8a62, transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
  );
  windowGlow.position.set(0, 3.55, -5.96);
  scene.add(windowGlow);

  const centerSigil = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.77, 48), emeraldMaterial);
  centerSigil.rotation.x = -Math.PI / 2;
  centerSigil.position.set(0, 0.025, -2.45);
  scene.add(centerSigil);
}

function createGate(scene, wallMaterial, trimMaterial) {
  const frameDepth = 0.48;
  for (const x of [-2.55, 2.55]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 5.55, frameDepth), wallMaterial);
    pillar.position.set(x, 2.75, 0.96);
    scene.add(pillar);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 5.35, frameDepth + 0.03), trimMaterial);
    edge.position.set(x + (x < 0 ? 0.19 : -0.19), 2.74, 0.95);
    scene.add(edge);
  }

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.42, 0.34, frameDepth), wallMaterial);
  lintel.position.set(0, 5.5, 0.96);
  scene.add(lintel);

  const left = new THREE.Group();
  left.position.set(-2.35, 0, 1.02);
  const right = new THREE.Group();
  right.position.set(2.35, 0, 1.02);
  scene.add(left, right);

  left.add(makeDoorPanel(1.175, wallMaterial, trimMaterial));
  right.add(makeDoorPanel(-1.175, wallMaterial, trimMaterial));
  return { left, right };
}

function makeDoorPanel(localX, wallMaterial, trimMaterial) {
  const group = new THREE.Group();
  group.position.x = localX;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.34, 5.18, 0.18), wallMaterial.clone());
  slab.material.color.setHex(0x020604);
  slab.material.metalness = 0.34;
  slab.material.roughness = 0.4;
  slab.position.y = 2.66;
  group.add(slab);

  const inset = new THREE.Mesh(new THREE.BoxGeometry(1.82, 4.48, 0.06), wallMaterial.clone());
  inset.material.color.setHex(0x06120d);
  inset.position.set(0, 2.66, 0.13);
  group.add(inset);

  for (const y of [0.56, 4.76]) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.035, 0.035), trimMaterial);
    line.position.set(0, y, 0.18);
    group.add(line);
  }

  const centerLine = new THREE.Mesh(new THREE.BoxGeometry(0.035, 4.18, 0.035), trimMaterial);
  centerLine.position.set(localX > 0 ? 0.87 : -0.87, 2.66, 0.18);
  group.add(centerLine);

  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), trimMaterial);
  handle.position.set(localX > 0 ? 0.84 : -0.84, 2.55, 0.27);
  group.add(handle);
  return group;
}

function createWater(scene) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
    uIntensity: { value: 0.55 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        p.z += sin((uv.y * 28.0) + (uv.x * 7.0)) * 0.012;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uIntensity;
      void main() {
        float edge = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);
        float waveA = sin(vUv.y * 82.0 - uTime * 2.4 + sin(vUv.x * 18.0)) * 0.5 + 0.5;
        float waveB = sin(vUv.y * 39.0 + uTime * 1.4) * 0.5 + 0.5;
        float eye = exp(-pow((vUv.x - 0.5) * 7.0, 2.0));
        vec3 deep = vec3(0.005, 0.045, 0.03);
        vec3 emerald = vec3(0.035, 0.72, 0.48);
        vec3 brightEmerald = vec3(0.16, 0.83, 0.59);
        vec3 color = mix(deep, emerald, eye * (0.28 + waveA * 0.22) * uIntensity);
        color = mix(color, brightEmerald, eye * waveB * 0.075 * uIntensity);
        float alpha = edge * (0.32 + eye * 0.34) * uIntensity;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 13, 20, 80), material);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.035, -0.2);
  scene.add(water);
  return { mesh: water, material };
}

function createInteractionObjects(scene, trimMaterial) {
  const objects = {};
  const hitboxes = [];
  const positions = {
    anchor: new THREE.Vector3(-1.28, 0, -4.05),
    aim: new THREE.Vector3(0, 0, -4.42),
    attend: new THREE.Vector3(1.28, 0, -4.05),
  };

  for (const step of STEP_ORDER) {
    const group = new THREE.Group();
    group.position.copy(positions[step]);
    const baseScale = 0.68;
    group.scale.setScalar(baseScale);
    scene.add(group);

    const pedestalMaterial = new THREE.MeshStandardMaterial({ color: 0x07100c, roughness: 0.46, metalness: 0.42 });
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.63, 0.74, 12), pedestalMaterial);
    pedestal.position.y = 0.37;
    group.add(pedestal);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.025, 8, 40), trimMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.73;
    group.add(rim);

    const coreMaterials = [];
    if (step === 'anchor') addAnchorObject(group, coreMaterials);
    if (step === 'aim') addAimObject(group, coreMaterials);
    if (step === 'attend') addAttendObject(group, coreMaterials);

    const haloMaterial = new THREE.MeshBasicMaterial({ color: 0x18c58b, transparent: true, opacity: 0, depthWrite: false });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.025, 8, 52), haloMaterial);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 0.05;
    halo.userData.active = false;
    group.add(halo);

    const light = new THREE.PointLight(step === 'aim' ? 0x2ad399 : 0x18c58b, 0, 5, 2);
    light.position.set(0, 1.3, 0.2);
    group.add(light);

    const hitbox = new THREE.Mesh(
      new THREE.SphereGeometry(0.86, 12, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.001, depthWrite: false }),
    );
    hitbox.position.y = 1.15;
    hitbox.userData.step = step;
    group.add(hitbox);
    hitboxes.push(hitbox);
    objects[step] = { group, halo, light, coreMaterials, baseScale };
  }

  return { objects, hitboxes };
}

function addAnchorObject(group, materials) {
  const flameMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f8d65,
    emissive: 0x18c58b,
    emissiveIntensity: 0.14,
    roughness: 0.2,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  materials.push(flameMaterial);
  const bowlMaterial = new THREE.MeshStandardMaterial({
    color: 0x11845f,
    emissive: 0x2ad399,
    emissiveIntensity: 0.12,
    roughness: 0.32,
    metalness: 0.74,
  });
  materials.push(bowlMaterial);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.18, 0.2, 24), bowlMaterial);
  bowl.position.y = 1.02;
  group.add(bowl);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.28, 12), bowlMaterial);
  stem.position.y = 0.84;
  group.add(stem);

  const flameShape = new THREE.Shape();
  flameShape.moveTo(0, -0.34);
  flameShape.bezierCurveTo(-0.28, -0.12, -0.24, 0.2, 0.02, 0.5);
  flameShape.bezierCurveTo(0.34, 0.14, 0.31, -0.16, 0, -0.34);
  const flame = new THREE.Mesh(new THREE.ShapeGeometry(flameShape, 24), flameMaterial);
  flame.position.set(0, 1.42, 0.03);
  group.add(flame);

  const innerMaterial = flameMaterial.clone();
  innerMaterial.color.setHex(0x2ad399);
  innerMaterial.emissive.setHex(0x2ad399);
  innerMaterial.emissiveIntensity = 0.12;
  materials.push(innerMaterial);
  const innerShape = new THREE.Shape();
  innerShape.moveTo(0, -0.18);
  innerShape.bezierCurveTo(-0.13, -0.05, -0.1, 0.12, 0.01, 0.25);
  innerShape.bezierCurveTo(0.16, 0.08, 0.14, -0.08, 0, -0.18);
  const inner = new THREE.Mesh(new THREE.ShapeGeometry(innerShape, 18), innerMaterial);
  inner.position.set(0.02, 1.35, 0.045);
  group.add(inner);
}

function addAimObject(group, materials) {
  const compassMaterial = new THREE.MeshStandardMaterial({
    color: 0x11845f,
    emissive: 0x2ad399,
    emissiveIntensity: 0.14,
    roughness: 0.3,
    metalness: 0.72,
  });
  materials.push(compassMaterial);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.045, 10, 48), compassMaterial);
  ring.position.y = 1.28;
  ring.rotation.x = -0.25;
  group.add(ring);
  const needle = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.78, 4), compassMaterial);
  needle.position.y = 1.28;
  needle.rotation.z = -0.78;
  group.add(needle);
}

function addAttendObject(group, materials) {
  const orbMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x075f44,
    emissive: 0x18c58b,
    emissiveIntensity: 0.14,
    roughness: 0.12,
    metalness: 0.15,
    transmission: 0.2,
    transparent: true,
    opacity: 0.88,
    clearcoat: 0.9,
  });
  materials.push(orbMaterial);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 32, 22), orbMaterial);
  orb.position.y = 1.28;
  group.add(orb);
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(0.54, 0.018, 8, 48),
    new THREE.MeshBasicMaterial({ color: 0x2ad399, transparent: true, opacity: 0.58 }),
  );
  orbit.position.y = 1.28;
  orbit.rotation.x = 1.04;
  orbit.rotation.y = 0.4;
  group.add(orbit);
}

function createRoomDoors(scene, wallMaterial, trimMaterial) {
  const doors = [];
  const xs = [-3.3, -1.1, 1.1, 3.3];
  xs.forEach((x, index) => {
    const frame = new THREE.Group();
    frame.position.set(x, 0, -5.28);
    scene.add(frame);
    const threshold = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.18, 0.5), trimMaterial.clone());
    threshold.position.set(0, 0.09, 0);
    frame.add(threshold);
    for (const side of [-1, 1]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.72, 0.34), trimMaterial.clone());
      jamb.position.set(side * 0.9, 1.36, 0);
      frame.add(jamb);
    }
    const arch = new THREE.Mesh(new THREE.RingGeometry(0.76, 0.9, 28, 1, 0, Math.PI), trimMaterial.clone());
    arch.position.set(0, 2.72, 0);
    frame.add(arch);
    const glow = new THREE.Mesh(
      new THREE.ShapeGeometry(createArchedShape(1.62, 3.42, 0.72)),
      new THREE.MeshBasicMaterial({ color: index % 2 ? 0x2ad399 : 0x18c58b, transparent: true, opacity: 0.025, depthWrite: false }),
    );
    glow.position.set(0, 0.08, -0.08);
    frame.add(glow);
    const panel = new THREE.Group();
    panel.position.set(-0.78, 0, 0.08);
    const slabMaterial = wallMaterial.clone();
    slabMaterial.color.setHex(0x020604);
    slabMaterial.side = THREE.DoubleSide;
    const slab = new THREE.Mesh(new THREE.ShapeGeometry(createArchedShape(1.56, 3.34, 0.68)), slabMaterial);
    slab.position.set(0.78, 0.08, 0);
    panel.add(slab);
    const insetMaterial = wallMaterial.clone();
    insetMaterial.color.setHex(0x063326);
    insetMaterial.emissive.setHex(0x04261b);
    insetMaterial.emissiveIntensity = 0.25;
    insetMaterial.side = THREE.DoubleSide;
    const panelLine = new THREE.Mesh(new THREE.ShapeGeometry(createArchedShape(1.16, 2.76, 0.52)), insetMaterial);
    panelLine.position.set(0.78, 0.32, 0.012);
    panel.add(panelLine);
    const handle = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), trimMaterial.clone());
    handle.position.set(1.25, 1.62, 0.05);
    panel.add(handle);
    frame.add(panel);
    const light = new THREE.PointLight(index % 2 ? 0x2ad399 : 0x18c58b, 0, 3.5, 2);
    light.position.set(0, 1.75, 1.2);
    frame.add(light);
    doors.push({ frame, panel, glow, light, openAngle: -1.62 });
  });
  return doors;
}

function createArchedShape(width, height, archHeight) {
  const half = width / 2;
  const shoulder = height - archHeight;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(half, shoulder);
  shape.quadraticCurveTo(half, height, 0, height);
  shape.quadraticCurveTo(-half, height, -half, shoulder);
  shape.lineTo(-half, 0);
  return shape;
}

function createAmbientSparks(scene) {
  const count = 70;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const p = i * 3;
    positions[p] = (Math.random() - 0.5) * 10;
    positions[p + 1] = 0.5 + Math.random() * 5;
    positions[p + 2] = -5.5 + Math.random() * 6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x79efc2,
    size: 0.035,
    map: makeSparkTexture(),
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return points;
}

function makeSparkTexture() {
  if (sparkTexture) return sparkTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(240,217,152,.92)');
  gradient.addColorStop(0.5, 'rgba(24,197,139,.4)');
  gradient.addColorStop(1, 'rgba(24,197,139,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  sparkTexture = new THREE.CanvasTexture(canvas);
  sparkTexture.colorSpace = THREE.SRGBColorSpace;
  return sparkTexture;
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

class Soundscape {
  constructor() {
    this.context = null;
    this.master = null;
    this.streamGain = null;
    this.muted = !soundEnabled;
    this.lastHoverAt = 0;
  }

  async start() {
    if (!this.context) this.create();
    if (!this.context || !this.master) return;
    if (this.context.state === 'suspended') await this.context.resume();
    this.master.gain.setTargetAtTime(this.muted ? 0.0001 : 0.16, this.context.currentTime, 0.05);
    soundToggle.classList.toggle('is-muted', this.muted);
    soundToggle.style.opacity = this.muted ? '0.55' : '1';
  }

  create() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(this.context.destination);

    const stream = this.context.createBufferSource();
    const seconds = 3;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * seconds, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      brown = (brown + 0.018 * white) / 1.018;
      data[i] = brown * 3.2;
    }
    stream.buffer = buffer;
    stream.loop = true;

    const highpass = this.context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 170;
    const lowpass = this.context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1700;
    lowpass.Q.value = 0.7;
    this.streamGain = this.context.createGain();
    this.streamGain.gain.value = 0.23;
    stream.connect(highpass).connect(lowpass).connect(this.streamGain).connect(this.master);
    stream.start();

    const hum = this.context.createOscillator();
    const humGain = this.context.createGain();
    hum.type = 'sine';
    hum.frequency.value = 82.4;
    humGain.gain.value = 0.022;
    hum.connect(humGain).connect(this.master);
    hum.start();
  }

  toggle() {
    return this.setMuted(!this.muted, true);
  }

  setMuted(muted, allowCreate = false) {
    if ((!this.context || !this.master) && allowCreate) this.create();
    this.muted = !!muted;
    soundEnabled = !this.muted;
    if (!this.context || !this.master) return this.muted;
    const value = this.muted ? 0.0001 : 0.16;
    this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.04);
    return this.muted;
  }

  door() {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(78, now);
    oscillator.frequency.exponentialRampToValueAtTime(36, now + 1.25);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 1.4);
  }

  hover() {
    if (!this.context || this.muted) return;
    const stamp = performance.now();
    if (stamp - this.lastHoverAt < 85) return;
    this.lastHoverAt = stamp;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(329.63, now);
    oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.14);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.035, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + 0.24);
  }

  confirm(index) {
    if (!this.context || this.muted) return;
    const notes = [392, 493.88, 587.33];
    this.tone(notes[index] || 440, 0, 0.26, 0.12);
    this.tone((notes[index] || 440) * 1.5, 0.08, 0.22, 0.06);
  }

  reward() {
    if (!this.context || this.muted) return;
    [392, 523.25, 659.25].forEach((frequency, index) => {
      this.tone(frequency, index * 0.13, 0.52, 0.11);
    });
  }

  travel() {
    if (!this.context || this.muted) return;
    this.tone(146.83, 0, 0.62, 0.07);
    this.tone(220, 0.18, 0.72, 0.05);
  }

  error() {
    if (!this.context || this.muted) return;
    this.tone(164.81, 0, 0.22, 0.045);
    this.tone(138.59, 0.12, 0.3, 0.035);
  }

  focus(active) {
    if (!this.context || this.muted || !this.streamGain) return;
    this.streamGain.gain.setTargetAtTime(active ? 0.31 : 0.23, this.context.currentTime, 0.22);
  }

  tone(frequency, delay, duration, volume) {
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.035);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
}

function bindInterfaceSounds() {
  const interactiveSelector = 'button:not(:disabled), [role="button"]:not([aria-disabled="true"]), a[href], select:not(:disabled)';

  document.addEventListener('pointerover', event => {
    if (event.pointerType && !['mouse', 'pen'].includes(event.pointerType)) return;
    const control = event.target instanceof Element ? event.target.closest(interactiveSelector) : null;
    if (!control) return;
    if (event.relatedTarget instanceof Node && control.contains(event.relatedTarget)) return;
    soundscape?.hover();
  }, { passive: true });

  document.addEventListener('focusin', event => {
    const control = event.target instanceof Element ? event.target.closest(interactiveSelector) : null;
    if (control) soundscape?.hover();
  });
}

soundscape = new Soundscape();
bindInterfaceSounds();
houseUI = createHouseUI({ world, soundscape, showToast, pulseHaptic, authSession });
