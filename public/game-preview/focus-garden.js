import * as THREE from '../vendor/three.module.js';

export const FOCUS_REWARDS = Object.freeze([
  {
    id: 'madonna-lily',
    kind: 'flower',
    name: 'Madonna lily',
    scientificName: 'Lilium candidum L.',
    family: 'Liliaceae',
    origin: 'Eastern Mediterranean and western Asia; cultivated around the Mediterranean since antiquity.',
    detail: 'Its trumpet-shaped white flowers open from a tall perennial bulb and are traditionally associated with purity and devotion.',
    scripture: '“Consider the lilies, how they grow.” — Luke 12:27',
    palette: [0xf4fff9, 0xdaf8eb, 0xd7b56d],
  },
  {
    id: 'crown-anemone',
    kind: 'flower',
    name: 'Crown anemone',
    scientificName: 'Anemone coronaria L.',
    family: 'Ranunculaceae',
    origin: 'Native to the Mediterranean region and western Asia.',
    detail: 'A tuberous spring flower whose vivid petals surround a dark central crown. It thrives after the cool, rainy season.',
    scripture: '“The flowers appear on the earth.” — Song of Songs 2:12',
    palette: [0xb8325b, 0xee6688, 0x17251d],
  },
  {
    id: 'almond-blossom',
    kind: 'flower',
    name: 'Almond blossom',
    scientificName: 'Prunus dulcis (Mill.) D.A.Webb',
    family: 'Rosaceae',
    origin: 'Rooted in southwest Asian ancestry and cultivated throughout the Mediterranean for millennia.',
    detail: 'Almond trees flower before their leaves return, making the pale blossom a living sign of watchfulness and beginnings.',
    scripture: '“I am watching over my word to perform it.” — Jeremiah 1:12',
    palette: [0xffdce8, 0xfff5f8, 0xd7b56d],
  },
  {
    id: 'olive-blossom',
    kind: 'flower',
    name: 'Olive blossom',
    scientificName: 'Olea europaea L.',
    family: 'Oleaceae',
    origin: 'Native across the Mediterranean basin, Africa, and parts of temperate Asia.',
    detail: 'Tiny cream flowers gather in branching clusters before fruit forms. The quiet bloom precedes a long season of faithful fruiting.',
    scripture: '“I am like a green olive tree in the house of God.” — Psalm 52:8',
    palette: [0xfff6d9, 0xeaf2cf, 0xb9c96b],
  },
  {
    id: 'mustard-hillside',
    kind: 'scene',
    name: 'Mustard Seed Hillside',
    scientificName: 'Parable study · Matthew 13:31–32',
    family: 'Kingdom parable',
    origin: 'A Galilean hillside assembled one faithful piece at a time.',
    detail: 'A small seed becomes shelter. This scene remembers that faithful attention can make room for life beyond the original task.',
    scripture: '“It is the smallest of all seeds, but when it has grown…” — Matthew 13:32',
    palette: [0xe0c84d, 0x4a8f54, 0x8ad8b2],
  },
  {
    id: 'emmaus-road',
    kind: 'scene',
    name: 'Road to Emmaus',
    scientificName: 'Gospel scene · Luke 24:13–35',
    family: 'Resurrection witness',
    origin: 'A seven-mile road from Jerusalem remembered through conversation, recognition, and return.',
    detail: 'Path, travelers, table, and light appear in stages. The completed scene honors understanding that arrives while we keep walking.',
    scripture: '“Were not our hearts burning within us while he talked with us?” — Luke 24:32',
    palette: [0xd7b56d, 0x6bbf93, 0xffe9b8],
  },
  {
    id: 'still-waters',
    kind: 'scene',
    name: 'Beside Still Waters',
    scientificName: 'Psalm scene · Psalm 23',
    family: 'Wisdom landscape',
    origin: 'A pastoral refuge built from water, path, pasture, and guiding light.',
    detail: 'The scene completes as the water settles and the path reaches the far bank—a reminder that rest can be part of faithful work.',
    scripture: '“He leads me beside still waters; he restores my soul.” — Psalm 23:2–3',
    palette: [0x44cfa0, 0x0b7f68, 0xc8f7df],
  },
  {
    id: 'faithful-light',
    kind: 'quote',
    name: 'A Lamp Kept Burning',
    scientificName: 'Focus meditation · Colossians 3:23',
    family: 'Wisdom fragment',
    origin: 'A quiet word placed into the Focus Garden.',
    detail: 'Not every session needs a monument. Some leave a sentence of light that can guide the next honest hour.',
    scripture: '“Whatever you do, work heartily, as for the Lord.” — Colossians 3:23',
    palette: [0xd7b56d, 0xfff1bd, 0x34d399],
  },
]);

export function pickFocusReward(seed = '', offset = 0) {
  const value = [...String(seed)].reduce((sum, character) => ((sum * 31) + character.charCodeAt(0)) >>> 0, Number(offset) || 0);
  return { ...FOCUS_REWARDS[value % FOCUS_REWARDS.length] };
}

export function createFocusGarden(canvas) {
  if (!canvas || !window.WebGLRenderingContext) return createFallback(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.4));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  camera.position.set(0, 2.1, 7.2);
  camera.lookAt(0, 1.25, 0);
  scene.add(new THREE.HemisphereLight(0xb9ffe2, 0x010403, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 6, 5);
  scene.add(key);
  const emerald = new THREE.PointLight(0x34d399, 10, 12, 2);
  emerald.position.set(-3, 2.5, 2);
  scene.add(emerald);

  const stage = new THREE.Group();
  scene.add(stage);
  let reward = FOCUS_REWARDS[0];
  let model = null;
  let targetProgress = 0;
  let visible = true;
  let lastTime = performance.now();

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, 48),
    new THREE.MeshStandardMaterial({ color: 0x04150e, roughness: 0.92, transparent: true, opacity: 0.9 }),
  );
  ground.rotation.x = -Math.PI / 2;
  stage.add(ground);

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize, { passive: true });
  resize();

  function setReward(next, progress = 0) {
    reward = next || FOCUS_REWARDS[0];
    if (model) stage.remove(model.group);
    model = reward.kind === 'flower'
      ? buildFlower(reward)
      : reward.kind === 'scene'
        ? buildFaithScene(reward)
        : buildQuoteLight(reward);
    stage.add(model.group);
    targetProgress = Math.max(0, Math.min(1, progress));
    model.update(targetProgress);
  }

  function setProgress(progress) {
    targetProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  }

  function reveal() {
    targetProgress = 1;
  }

  function frame(time) {
    const delta = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;
    if (visible && canvas.offsetParent !== null && model) {
      model.progress += (targetProgress - model.progress) * Math.min(1, delta * 4.2);
      model.update(model.progress, time);
      model.group.rotation.y = Math.sin(time * 0.00024) * 0.12;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
  }

  setReward(reward, 0);
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible'; });
  return { setReward, setProgress, reveal, resize, current: () => reward };
}

function buildFlower(reward) {
  const group = new THREE.Group();
  const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x177a52, roughness: 0.72 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 2.35, 10), stemMaterial);
  stem.position.y = 1.17;
  group.add(stem);
  const leaves = [-1, 1].map((side, index) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 10), stemMaterial.clone());
    leaf.scale.set(1.9, 0.32, 0.72);
    leaf.rotation.z = side * 0.64;
    leaf.position.set(side * 0.28, 0.72 + index * 0.48, 0);
    group.add(leaf);
    return leaf;
  });
  const bloom = new THREE.Group();
  bloom.position.y = 2.4;
  group.add(bloom);
  const colors = reward.palette || [0xffffff, 0xe8fff5, 0xd7b56d];
  const petals = [];
  for (let index = 0; index < 8; index += 1) {
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 20, 12),
      new THREE.MeshPhysicalMaterial({ color: colors[index % 2], roughness: 0.36, clearcoat: 0.18, side: THREE.DoubleSide }),
    );
    const angle = (index / 8) * Math.PI * 2;
    petal.scale.set(0.68, 1.45, 0.28);
    petal.position.set(Math.cos(angle) * 0.36, Math.sin(angle) * 0.22, Math.sin(angle) * 0.14);
    petal.rotation.z = angle - Math.PI / 2;
    petal.rotation.x = 0.48;
    bloom.add(petal);
    petals.push(petal);
  }
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 20, 14),
    new THREE.MeshStandardMaterial({ color: colors[2], emissive: colors[2], emissiveIntensity: 0.22, roughness: 0.55 }),
  );
  center.position.z = 0.12;
  bloom.add(center);
  return {
    group,
    progress: 0,
    update(progress, time = 0) {
      const stemProgress = Math.min(1, progress / 0.58);
      stem.scale.y = Math.max(0.02, stemProgress);
      stem.position.y = 1.17 * stem.scale.y;
      leaves.forEach((leaf, index) => {
        const leafProgress = Math.max(0, Math.min(1, (progress - 0.2 - index * 0.12) / 0.3));
        leaf.scale.set(1.9 * leafProgress, 0.32 * leafProgress, 0.72 * leafProgress);
      });
      const bloomProgress = Math.max(0.02, Math.min(1, (progress - 0.48) / 0.52));
      bloom.position.y = 2.35 * stemProgress;
      bloom.scale.setScalar(bloomProgress);
      petals.forEach((petal, index) => { petal.rotation.x = 1.25 - bloomProgress * 0.82 + Math.sin(time * 0.001 + index) * 0.02; });
      bloom.rotation.z = Math.sin(time * 0.0008) * 0.025;
    },
  };
}

function buildFaithScene(reward) {
  const group = new THREE.Group();
  const colors = reward.palette || [0xd7b56d, 0x34d399, 0xeafff7];
  const pieces = [];
  const path = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 4.5), new THREE.MeshStandardMaterial({ color: 0x7b6845, roughness: 0.94 }));
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = 0.12;
  path.position.set(0, 0.025, -0.1);
  group.add(path);
  pieces.push(path);
  for (let index = 0; index < 8; index += 1) {
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(0.7 + (index % 3) * 0.18, 16, 10),
      new THREE.MeshStandardMaterial({ color: index % 2 ? colors[1] : 0x0a5d42, roughness: 0.9 }),
    );
    hill.scale.y = 0.34;
    hill.position.set((index % 2 ? 1 : -1) * (0.8 + (index % 3) * 0.55), 0.18, -1.7 + index * 0.45);
    group.add(hill);
    pieces.push(hill);
  }
  const tree = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 1.7, 9), new THREE.MeshStandardMaterial({ color: 0x4b3526, roughness: 0.9 }));
  trunk.position.y = 0.85;
  tree.add(trunk);
  for (const [x, y, scale] of [[0, 1.8, 0.72], [-0.45, 1.55, 0.58], [0.46, 1.6, 0.62]]) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(scale, 1), new THREE.MeshStandardMaterial({ color: colors[1], roughness: 0.78 }));
    crown.position.set(x, y, 0);
    tree.add(crown);
  }
  tree.position.set(-1.25, 0, -1.15);
  group.add(tree);
  pieces.push(tree);
  if (reward.id === 'still-waters') {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 2.4),
      new THREE.MeshPhysicalMaterial({ color: colors[1], emissive: colors[1], emissiveIntensity: 0.22, transparent: true, opacity: 0.64, roughness: 0.16, transmission: 0.18 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0.7, 0.055, -0.35);
    group.add(water);
    pieces.push(water);
  } else if (reward.id === 'emmaus-road') {
    for (const [index, x] of [-0.2, 0.32].entries()) {
      const traveler = new THREE.Group();
      const robe = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.62, 10), new THREE.MeshStandardMaterial({ color: index ? 0x8f7144 : 0x446f61, roughness: 0.86 }));
      robe.position.y = 0.31;
      traveler.add(robe);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshStandardMaterial({ color: 0xb88c68, roughness: 0.9 }));
      head.position.y = 0.71;
      traveler.add(head);
      traveler.position.set(x, 0, 0.8 + index * 0.3);
      traveler.rotation.y = -0.16;
      group.add(traveler);
      pieces.push(traveler);
    }
  } else if (reward.id === 'mustard-hillside') {
    for (let index = 0; index < 14; index += 1) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: colors[0], emissive: colors[0], emissiveIntensity: 0.18 }));
      flower.position.set(-1.7 + (index % 7) * 0.5, 0.24 + (index % 3) * 0.04, -0.8 + Math.floor(index / 7) * 1.2);
      group.add(flower);
      pieces.push(flower);
    }
  }
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), new THREE.MeshBasicMaterial({ color: colors[2] }));
  light.position.set(1.2, 2.1, -1.8);
  group.add(light);
  pieces.push(light);
  pieces.forEach((piece, index) => { piece.userData.revealAt = index / Math.max(1, pieces.length - 1); });
  return {
    group,
    progress: 0,
    update(progress, time = 0) {
      pieces.forEach(piece => {
        const amount = Math.max(0, Math.min(1, (progress - piece.userData.revealAt) * 4));
        piece.visible = amount > 0.01;
        piece.scale.setScalar(Math.max(0.01, amount));
      });
      light.scale.setScalar(0.7 + Math.sin(time * 0.002) * 0.12);
    },
  };
}

function buildQuoteLight(reward) {
  const group = new THREE.Group();
  const colors = reward.palette || [0xd7b56d, 0xfff1bd, 0x34d399];
  const lamp = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.72, 2),
    new THREE.MeshPhysicalMaterial({ color: colors[0], emissive: colors[0], emissiveIntensity: 0.85, transparent: true, opacity: 0.82, roughness: 0.2 }),
  );
  lamp.position.y = 1.45;
  group.add(lamp);
  const rings = [0.8, 1.2, 1.58].map(radius => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.025, 8, 52), new THREE.MeshBasicMaterial({ color: colors[2], transparent: true, opacity: 0.34 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    group.add(ring);
    return ring;
  });
  return {
    group,
    progress: 0,
    update(progress, time = 0) {
      lamp.scale.setScalar(Math.max(0.04, progress));
      lamp.rotation.y = time * 0.00045;
      lamp.material.opacity = 0.22 + progress * 0.68;
      rings.forEach((ring, index) => {
        ring.scale.setScalar(0.4 + progress * (0.6 + index * 0.12));
        ring.material.opacity = progress * (0.34 - index * 0.05);
      });
    },
  };
}

function createFallback(canvas) {
  if (canvas) canvas.hidden = true;
  let reward = FOCUS_REWARDS[0];
  return {
    setReward(next) { reward = next || reward; },
    setProgress() {},
    reveal() {},
    resize() {},
    current: () => reward,
  };
}
