import * as THREE from './vendor/three.module.js';

const SKIN_TONES = ['#3D2914', '#5D3A1A', '#7A4A23', '#9C6B3F', '#B8865B', '#D4A574'];
const HAIR_COLORS = ['#0A0A0A', '#3B2417', '#7C5A3F', '#C0392B', '#D4A24E', '#9B59B6'];
const OUTFITS = {
  classic:  { primary: '#050806', accent: '#D7A94D' },
  emerald:  { primary: '#0F8F6D', accent: '#19C58F' },
  kente:    { primary: '#D7A94D', accent: '#0F8F6D' },
  adwoa:    { primary: '#111712', accent: '#D7A94D' },
  minister: { primary: '#030504', accent: '#D7A94D' },
  warrior:  { primary: '#050806', accent: '#19C58F' },
};

const ACTIONS = ['idle', 'wave', 'sip', 'read', 'pray', 'banner', 'dance', 'think', 'sleep'];

export function canRenderThreeMoji() {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function mountThreeMoji(target, cfg = {}, options = {}) {
  if (!target || !canRenderThreeMoji()) return null;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const palette = getPalette(cfg);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'default',
    preserveDrawingBuffer: true,
  });

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.className = 'three-moji-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  target.replaceChildren(renderer.domElement);
  target.classList.add('three-moji-ready');
  target.dataset.threeMoji = 'ready';

  const rig = buildMojiRig(cfg, palette, options);
  scene.add(rig.root);
  scene.add(new THREE.AmbientLight(0xd7fbea, 1.25));

  const keyLight = new THREE.DirectionalLight(0xf6df9d, 2.4);
  keyLight.position.set(2.4, 4.2, 5.2);
  scene.add(keyLight);

  const rim = new THREE.PointLight(0x19c58f, 2.2, 8);
  rim.position.set(-2.5, 1.8, 2.5);
  scene.add(rim);

  const goldRim = new THREE.PointLight(0xd7a94d, 1.3, 6);
  goldRim.position.set(2.8, 2.6, -1.6);
  scene.add(goldRim);

  camera.position.set(0, options.mini ? 1.55 : 1.35, options.mini ? 5.9 : 6.15);
  camera.lookAt(0, 1.05, 0);

  let action = normalizeAction(options.action || cfg.action || 'idle');
  let raf = 0;
  let disposed = false;
  const clock = new THREE.Clock();
  const actionCycle = ['idle', 'wave', 'sip', 'read', 'pray', 'banner'];

  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, Math.floor(target.clientWidth || options.width || 220));
    const height = Math.max(1, Math.floor(target.clientHeight || options.height || 280));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const observer = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(resize)
    : null;
  observer?.observe(target);
  window.addEventListener('resize', resize);
  resize();

  function tick() {
    if (disposed) return;
    const t = clock.getElapsedTime();
    applyMojiPose(rig, action, reducedMotion ? t * 0.35 : t);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }

  tick();

  if (options.interactive !== false) {
    target.addEventListener('click', () => {
      const idx = actionCycle.indexOf(action);
      action = actionCycle[(idx + 1) % actionCycle.length];
    });
  }

  return {
    get action() {
      return action;
    },
    setAction(next) {
      action = normalizeAction(next);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      scene.traverse(disposeObject);
      renderer.dispose();
      target.classList.remove('three-moji-ready');
      delete target.dataset.threeMoji;
    },
  };
}

function buildMojiRig(cfg, palette, options) {
  const root = new THREE.Group();
  root.position.y = -1.45;
  root.rotation.y = options.mini ? -0.1 : 0.08;
  root.scale.setScalar(options.mini ? 0.88 : 1);

  const gender = cfg.gender === 'masculine' ? 'masculine' : 'feminine';
  const skinMat = material(palette.skin, 0.5, 0.02);
  const skinDarkMat = material(palette.skinShade, 0.6, 0);
  const hairMat = material(palette.hair, 0.58, 0.05);
  const outfitMat = material(palette.outfit, 0.48, 0.04);
  const accentMat = material(palette.accent, 0.36, 0.18);
  const goldMat = material('#D7A94D', 0.25, 0.45);
  const blackMat = material('#050806', 0.62, 0.02);
  const whiteMat = material('#F7F1E5', 0.5, 0.02);

  const glow = createGlowParticles(palette);
  root.add(glow);

  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.position.y = 1.08;
  root.add(torso);

  const bodyGeo = new THREE.CapsuleGeometry(gender === 'masculine' ? 0.47 : 0.42, 0.84, 10, 24);
  const body = new THREE.Mesh(bodyGeo, outfitMat);
  body.scale.set(gender === 'masculine' ? 1.15 : 0.92, 1.08, 0.68);
  body.position.y = 0.05;
  torso.add(body);

  if (gender === 'feminine') {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.76, 0.52, 32), outfitMat);
    skirt.position.y = -0.44;
    skirt.scale.z = 0.72;
    torso.add(skirt);
  }

  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.018, 8, 48), accentMat);
  sash.rotation.x = Math.PI / 2;
  sash.position.y = 0.13;
  sash.scale.set(gender === 'masculine' ? 1.13 : 0.96, 0.65, 1);
  torso.add(sash);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.28, 24), skinMat);
  neck.position.y = 1.65;
  root.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 36, 24), skinMat);
  head.name = 'head';
  head.position.y = 2.08;
  head.scale.set(gender === 'masculine' ? 1.03 : 0.96, 1.08, 0.92);
  root.add(head);

  const hair = createHair(cfg, hairMat);
  hair.name = 'hair';
  hair.position.y = 2.08;
  root.add(hair);

  const face = createFace(cfg, palette, {
    blackMat,
    whiteMat,
    accentMat,
    skinDarkMat,
  });
  face.name = 'face';
  face.position.y = 2.08;
  root.add(face);

  const accessories = createAccessories(cfg, palette, { goldMat, accentMat, blackMat, hairMat });
  accessories.name = 'accessories';
  accessories.position.y = 2.08;
  root.add(accessories);

  const leftArm = createArm(-1, skinMat, outfitMat);
  const rightArm = createArm(1, skinMat, outfitMat);
  leftArm.name = 'leftArm';
  rightArm.name = 'rightArm';
  root.add(leftArm, rightArm);

  const leftLeg = createLeg(-1, gender, skinMat, outfitMat, blackMat);
  const rightLeg = createLeg(1, gender, skinMat, outfitMat, blackMat);
  leftLeg.name = 'leftLeg';
  rightLeg.name = 'rightLeg';
  root.add(leftLeg, rightLeg);

  const mug = createMug(goldMat, blackMat);
  mug.name = 'mug';
  root.add(mug);

  const book = createBook(goldMat, whiteMat, accentMat);
  book.name = 'book';
  root.add(book);

  const banner = createBanner(options.bannerText || 'steady is still progress', palette);
  banner.name = 'banner';
  root.add(banner);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 48),
    new THREE.MeshBasicMaterial({ color: 0x19c58f, transparent: true, opacity: 0.1 }),
  );
  ground.name = 'groundGlow';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  root.add(ground);

  return {
    root,
    torso,
    head,
    hair,
    face,
    accessories,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    mug,
    book,
    banner,
    glow,
    ground,
  };
}

function createArm(side, skinMat, outfitMat) {
  const group = new THREE.Group();
  group.position.set(side * 0.52, 1.44, 0.03);

  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.12, 0.3, 18), outfitMat);
  sleeve.position.y = -0.15;
  group.add(sleeve);

  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.088, 0.62, 18), skinMat);
  forearm.position.y = -0.47;
  group.add(forearm);

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 12), skinMat);
  hand.name = 'hand';
  hand.position.y = -0.82;
  group.add(hand);

  return group;
}

function createLeg(side, gender, skinMat, outfitMat, shoeMat) {
  const group = new THREE.Group();
  group.position.set(side * 0.25, 0.46, 0);

  const legMat = gender === 'masculine' ? outfitMat : skinMat;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.11, 0.78, 18), legMat);
  leg.position.y = -0.32;
  group.add(leg);

  const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.34), shoeMat);
  shoe.position.set(side * 0.03, -0.75, 0.09);
  shoe.rotation.y = side * 0.1;
  group.add(shoe);

  return group;
}

function createHair(cfg, hairMat) {
  const group = new THREE.Group();
  const style = cfg.hairStyle || 'short';

  if (style === 'shaved') return group;

  if (style === 'afro') {
    const afro = new THREE.Mesh(new THREE.SphereGeometry(0.66, 36, 20), hairMat);
    afro.position.y = 0.22;
    afro.scale.set(1.12, 0.85, 0.95);
    group.add(afro);
  } else {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
    cap.position.y = 0.28;
    cap.scale.set(1.08, 0.9, 0.96);
    group.add(cap);
  }

  if (style === 'twists') {
    for (let i = 0; i < 9; i += 1) {
      const x = (i - 4) * 0.105;
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 10), hairMat);
      puff.position.set(x, 0.46 - Math.abs(i - 4) * 0.025, 0.18);
      group.add(puff);
    }
  }

  if (style === 'braids' || style === 'locs') {
    const count = style === 'braids' ? 8 : 10;
    for (let i = 0; i < count; i += 1) {
      const side = i < count / 2 ? -1 : 1;
      const row = i % (count / 2);
      const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, style === 'locs' ? 0.78 : 0.62, 10), hairMat);
      strand.position.set(side * (0.37 + row * 0.055), -0.05 - row * 0.02, -0.06);
      strand.rotation.z = side * 0.12;
      group.add(strand);
    }
  }

  return group;
}

function createFace(cfg, palette, mats) {
  const group = new THREE.Group();
  const expression = cfg.expression || 'steady';
  const eyeY = expression === 'prayer' ? 0.03 : 0.06;

  if (expression === 'prayer') {
    group.add(createCurveLine([[-0.19, 0.04, 0.46], [-0.12, 0, 0.5], [-0.05, 0.04, 0.46]], palette.hair, 0.015));
    group.add(createCurveLine([[0.05, 0.04, 0.46], [0.12, 0, 0.5], [0.19, 0.04, 0.46]], palette.hair, 0.015));
  } else {
    [-1, 1].forEach(side => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 12), mats.whiteMat);
      eye.position.set(side * 0.15, eyeY, 0.46);
      eye.scale.x = expression === 'focused' ? 1.25 : 1;
      group.add(eye);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), mats.blackMat);
      pupil.position.set(side * 0.15, eyeY - 0.002, 0.497);
      group.add(pupil);
    });
  }

  const browY = expression === 'focused' ? 0.17 : 0.16;
  group.add(createCurveLine([[-0.24, browY, 0.46], [-0.16, browY + 0.035, 0.49], [-0.07, browY, 0.46]], palette.hair, 0.014));
  group.add(createCurveLine([[0.07, browY, 0.46], [0.16, browY + 0.035, 0.49], [0.24, browY, 0.46]], palette.hair, 0.014));

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.13, 16), mats.skinDarkMat);
  nose.position.set(0, -0.04, 0.49);
  nose.rotation.x = Math.PI / 2;
  nose.material.transparent = true;
  nose.material.opacity = 0.42;
  group.add(nose);

  const smileDepth = expression === 'joyful' || expression === 'spark' ? -0.12 : -0.09;
  const mouthColor = expression === 'spark' ? palette.accent : palette.skinShade;
  group.add(createCurveLine([[-0.13, smileDepth, 0.5], [0, smileDepth - 0.055, 0.525], [0.13, smileDepth, 0.5]], mouthColor, 0.016));

  return group;
}

function createAccessories(cfg, palette, mats) {
  const group = new THREE.Group();
  const accessory = cfg.accessory || 'none';
  const aura = cfg.aura || 'halo';

  if (aura === 'halo' || aura === 'fireflies' || aura === 'anointing') {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.025, 8, 72), mats.goldMat);
    halo.name = 'halo';
    halo.position.y = 0.72;
    halo.rotation.x = Math.PI / 2.25;
    group.add(halo);
  }

  if (accessory === 'hoops') {
    [-1, 1].forEach(side => {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.01, 8, 24), mats.goldMat);
      hoop.position.set(side * 0.47, -0.03, 0.01);
      hoop.rotation.y = Math.PI / 2;
      group.add(hoop);
    });
  }

  if (accessory === 'glasses') {
    [-1, 1].forEach(side => {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.009, 8, 32), mats.goldMat);
      lens.position.set(side * 0.15, 0.055, 0.5);
      group.add(lens);
    });
    group.add(createCurveLine([[-0.05, 0.055, 0.5], [0, 0.048, 0.515], [0.05, 0.055, 0.5]], palette.accent, 0.01));
  }

  if (accessory === 'headwrap') {
    const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.58, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), mats.accentMat);
    wrap.position.y = 0.32;
    wrap.scale.set(1.05, 0.76, 0.9);
    group.add(wrap);

    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 12), mats.goldMat);
    knot.position.set(0.18, 0.49, 0.2);
    knot.scale.set(1.3, 0.8, 0.75);
    group.add(knot);
  }

  if (accessory === 'crown') {
    const base = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 8, 48), mats.goldMat);
    base.position.y = 0.54;
    base.rotation.x = Math.PI / 2;
    group.add(base);
    for (let i = 0; i < 5; i += 1) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 5), mats.goldMat);
      spike.position.set((i - 2) * 0.13, 0.64 - Math.abs(i - 2) * 0.018, 0.02);
      group.add(spike);
    }
  }

  return group;
}

function createMug(goldMat, blackMat) {
  const group = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.17, 24), blackMat);
  cup.rotation.x = Math.PI / 2;
  group.add(cup);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.008, 8, 28), goldMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.z = 0.085;
  group.add(rim);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 8, 24), goldMat);
  handle.position.set(0.095, 0, 0);
  handle.rotation.y = Math.PI / 2;
  group.add(handle);

  group.visible = false;
  return group;
}

function createBook(goldMat, whiteMat, accentMat) {
  const group = new THREE.Group();
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.34), goldMat);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 0.34), whiteMat);
  left.position.x = -0.23;
  right.position.x = 0.23;
  left.rotation.y = -0.32;
  right.rotation.y = 0.32;
  group.add(left, right);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.045, 0.37), accentMat);
  group.add(spine);

  group.position.set(0, 0.95, 0.68);
  group.rotation.x = -0.55;
  group.visible = false;
  return group;
}

function createBanner(text, palette) {
  const texture = new THREE.CanvasTexture(createBannerCanvas(text, palette));
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const group = new THREE.Group();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 0.42), mat);
  group.add(plane);
  group.position.set(0, 1.05, 0.78);
  group.visible = false;
  return group;
}

function createGlowParticles(palette) {
  const group = new THREE.Group();
  const colors = [palette.accent, '#D7A94D', '#19C58F'];
  for (let i = 0; i < 18; i += 1) {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.018 + (i % 3) * 0.006, 8, 6),
      new THREE.MeshBasicMaterial({
        color: colors[i % colors.length],
        transparent: true,
        opacity: 0.48,
      }),
    );
    const angle = (i / 18) * Math.PI * 2;
    const radius = 0.85 + (i % 4) * 0.12;
    dot.position.set(Math.cos(angle) * radius, 1.35 + Math.sin(i) * 0.7, Math.sin(angle) * 0.24);
    dot.userData.phase = i * 0.58;
    group.add(dot);
  }
  return group;
}

function applyMojiPose(rig, action, t) {
  const s = Math.sin;
  const c = Math.cos;
  const bob = s(t * 2) * 0.025;
  rig.root.position.y = -1.45 + bob;
  rig.root.rotation.z = 0;
  rig.torso.rotation.set(0, 0, 0);
  rig.head.rotation.set(0, 0, 0);
  rig.leftArm.rotation.set(0, 0, -0.28);
  rig.rightArm.rotation.set(0, 0, 0.28);
  rig.leftLeg.rotation.set(0, 0, -0.05);
  rig.rightLeg.rotation.set(0, 0, 0.05);
  rig.mug.visible = false;
  rig.book.visible = false;
  rig.banner.visible = false;

  rig.glow.children.forEach((dot, idx) => {
    dot.position.y += s(t * 1.4 + dot.userData.phase) * 0.0009;
    dot.material.opacity = 0.22 + Math.abs(s(t * 1.2 + idx)) * 0.36;
  });

  if (action === 'wave') {
    rig.leftArm.rotation.z = -2.42 + s(t * 7) * 0.34;
    rig.rightArm.rotation.z = 0.22;
    rig.head.rotation.z = s(t * 2.1) * 0.04;
  } else if (action === 'sip') {
    rig.rightArm.rotation.z = -2.5 + s(t * 2.8) * 0.08;
    rig.leftArm.rotation.z = -0.18;
    rig.mug.visible = true;
    rig.mug.position.set(0.32 + c(t * 2.8) * 0.015, 2.04 + s(t * 2.8) * 0.02, 0.53);
    rig.mug.rotation.set(0.15, 0.1, 0.1);
    rig.head.rotation.z = -0.04 + s(t * 2.8) * 0.02;
  } else if (action === 'read') {
    rig.book.visible = true;
    rig.book.rotation.z = s(t * 1.6) * 0.025;
    rig.leftArm.rotation.z = -1.18;
    rig.rightArm.rotation.z = 1.18;
    rig.leftArm.rotation.x = 0.34;
    rig.rightArm.rotation.x = 0.34;
    rig.head.rotation.x = -0.08 + s(t * 1.3) * 0.02;
  } else if (action === 'pray') {
    rig.leftArm.rotation.z = -1.68 + s(t * 1.5) * 0.025;
    rig.rightArm.rotation.z = 1.68 - s(t * 1.5) * 0.025;
    rig.leftArm.rotation.x = 0.38;
    rig.rightArm.rotation.x = 0.38;
    rig.head.rotation.x = -0.11;
    rig.root.position.y -= 0.05 + Math.abs(s(t * 1.2)) * 0.015;
  } else if (action === 'banner') {
    rig.banner.visible = true;
    rig.banner.position.y = 1.03 + s(t * 2.2) * 0.018;
    rig.leftLeg.rotation.z = -0.32 * s(t * 7.5);
    rig.rightLeg.rotation.z = 0.32 * s(t * 7.5);
    rig.leftArm.rotation.z = -0.7 + 0.22 * s(t * 7.5);
    rig.rightArm.rotation.z = 0.7 - 0.22 * s(t * 7.5);
    rig.torso.rotation.z = s(t * 7.5) * 0.035;
  } else if (action === 'dance') {
    rig.root.rotation.z = s(t * 5.5) * 0.08;
    rig.leftArm.rotation.z = -1.1 + s(t * 5.5) * 0.22;
    rig.rightArm.rotation.z = 1.1 - s(t * 5.5) * 0.22;
    rig.leftLeg.rotation.z = -0.18 + s(t * 5.5) * 0.18;
    rig.rightLeg.rotation.z = 0.18 - s(t * 5.5) * 0.18;
  } else if (action === 'think') {
    rig.head.rotation.z = 0.08 + s(t * 1.4) * 0.015;
    rig.rightArm.rotation.z = -2.18;
  } else if (action === 'sleep') {
    rig.head.rotation.z = -0.12;
    rig.root.position.y = -1.47 + s(t * 0.7) * 0.01;
  }

  rig.accessories.children.forEach(child => {
    if (child.name === 'halo') child.rotation.z = t * 0.45;
  });
  rig.ground.scale.setScalar(1 + Math.abs(s(t * 1.8)) * 0.08);
}

function createCurveLine(points, color, radius = 0.01) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const geo = new THREE.TubeGeometry(curve, 16, radius, 6, false);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
}

function createBannerCanvas(text, palette) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#030504';
  roundRect(ctx, 28, 28, 968, 200, 42);
  ctx.fill();
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 8;
  roundRect(ctx, 28, 28, 968, 200, 42);
  ctx.stroke();
  ctx.strokeStyle = '#D7A94D';
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.55;
  roundRect(ctx, 48, 48, 928, 160, 32);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#D7A94D';
  ctx.font = '700 54px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(text).slice(0, 72), 512, 128, 850);
  return canvas;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function getPalette(cfg) {
  const outfit = OUTFITS[cfg.outfit] || OUTFITS.emerald;
  const skin = SKIN_TONES[Number.isInteger(cfg.skinTone) ? cfg.skinTone : 0] || SKIN_TONES[0];
  return {
    skin,
    skinShade: shade(skin, -24),
    hair: HAIR_COLORS[Number.isInteger(cfg.hairColor) ? cfg.hairColor : 0] || HAIR_COLORS[0],
    outfit: outfit.primary,
    accent: outfit.accent,
  };
}

function normalizeAction(action) {
  return ACTIONS.includes(action) ? action : 'idle';
}

function material(color, roughness, metalness) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

function shade(hex, pct) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const adj = v => Math.max(0, Math.min(255, Math.round(v + (pct / 100) * 255)));
  return `#${[adj(r), adj(g), adj(b)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function disposeObject(obj) {
  if (obj.geometry) obj.geometry.dispose();
  const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
  materials.filter(Boolean).forEach(mat => {
    if (mat.map) mat.map.dispose();
    mat.dispose?.();
  });
}
