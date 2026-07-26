import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanPortions, countCompletedPlanDays, selectCurrentPlanPortion } from '../public/game-preview/bible-plan.js';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

test('bundled WEB-C canon includes Tobit and real verse data', async () => {
  const manifest = JSON.parse(await readFile(new URL('public/game-preview/bible/web-c/manifest.json', root), 'utf8'));
  const tobit = manifest.books.find(book => book.id === 'TOB');
  assert.equal(manifest.publicDomain, true);
  assert.equal(manifest.books.length, 73);
  assert.equal(tobit?.chapters, 14);
  assert.ok(tobit.verseCounts.every(count => count > 0));
  const chapter = JSON.parse(await readFile(new URL('public/game-preview/bible/web-c/TOB/001.json', root), 'utf8'));
  assert.equal(chapter.name, 'Tobit');
  assert.equal(chapter.verses[0].number, '1');
  assert.match(chapter.verses[0].text, /Tobit/);
});

test('room architecture uses four dedicated builders and threshold traversal', async () => {
  const game = await readFile(new URL('public/game-preview/game.js', root), 'utf8');
  for (const builder of ['buildChapelRoom', 'buildWorkshopRoom', 'buildGardenRoom', 'buildArchiveRoom']) {
    assert.match(game, new RegExp(`function ${builder}\\(`));
  }
  assert.match(game, /enterAtriumHub/);
  assert.match(game, /door\.panel\.rotation\.y/);
  assert.doesNotMatch(game, /function buildRoomObject/);
});

test('game viewport remains fixed and visited room doors close on return', async () => {
  const [game, styles] = await Promise.all([
    readFile(new URL('public/game-preview/game.js', root), 'utf8'),
    readFile(new URL('public/game-preview/game.css', root), 'utf8'),
  ]);
  assert.match(styles, /\.game\s*>\s*:not\(\.auth-world\)\s*\{[^}]*position:\s*fixed/s);
  assert.doesNotMatch(game, /viewport-correction|normalizeViewport/);
  assert.match(game, /returnDoor\.panel\.rotation\.y\s*=\s*THREE\.MathUtils\.lerp\(returnDoor\.openAngle,\s*0,\s*progress\)/);
});

test('installed game registers update handling before authentication can block', async () => {
  const game = await readFile(new URL('public/game-preview/game.js', root), 'utf8');
  assert.ok(game.indexOf('initGamePwa();') < game.indexOf('await requireGameAuth'));
});

test('daily rhythm starts small and does not silently require every practice', async () => {
  const data = await readFile(new URL('public/game-preview/data.js', root), 'utf8');
  const suggested = [...data.matchAll(/suggested:\s*true/g)];
  assert.equal(suggested.length, 3);
  assert.match(data, /\['closed', 'paused', 'open'\]/);
  assert.match(data, /dailyRuleHistory/);
});

test('health teaching excludes the unsupported grey-matter claim', async () => {
  const content = await readFile(new URL('public/game-preview/rhythm-bible-ui.js', root), 'utf8');
  assert.doesNotMatch(content, /prayer reduces gr[ae]y matter/i);
  assert.match(content, /do not prove/);
  assert.match(content, /human evidence is still developing/i);
});

test('installed app handles real push events and exact destinations', async () => {
  const serviceWorker = await readFile(new URL('public/game-preview/sw.js', root), 'utf8');
  assert.match(serviceWorker, /addEventListener\('push'/);
  assert.match(serviceWorker, /showNotification/);
  assert.match(serviceWorker, /addEventListener\('notificationclick'/);
  assert.match(serviceWorker, /\?open=rhythm/);
});

test('integrated design layer augments the full game instead of replacing it', async () => {
  const [index, styles, game, rootEntry] = await Promise.all([
    readFile(new URL('public/game-preview/index.html', root), 'utf8'),
    readFile(new URL('public/game-preview/glass-system.css', root), 'utf8'),
    readFile(new URL('public/game-preview/game.js', root), 'utf8'),
    readFile(new URL('public/index.html', root), 'utf8'),
  ]);
  assert.match(index, /glass-system\.css\?v=__BUILD__/);
  assert.match(index, /class="glass-system"/);
  assert.match(styles, /--glass-surface:/);
  assert.match(styles, /backdrop-filter:\s*blur\(22px\)\s+saturate\(126%\)/);
  assert.match(styles, /"JetBrains Mono"/);
  assert.match(game, /hover\(\)\s*\{/);
  assert.match(game, /addEventListener\('pointerover'/);
  assert.match(rootEntry, /new URL\('\.\/game-preview\/'/);
  for (const builder of ['buildChapelRoom', 'buildWorkshopRoom', 'buildGardenRoom', 'buildArchiveRoom']) {
    assert.match(game, new RegExp(`function ${builder}\\(`));
  }
});

test('custom Bible goals cover every verse once across chapter boundaries', () => {
  const portions = buildPlanPortions({ id: 'TST', verseCounts: [3, 4, 2] }, 4);
  const verses = portions.flatMap(portion => Array.from(
    { length: portion.verseEnd - portion.verseStart + 1 },
    (_, index) => `${portion.chapter}:${portion.verseStart + index}`,
  ));
  assert.deepEqual(verses, ['1:1', '1:2', '1:3', '2:1', '2:2', '2:3', '2:4', '3:1', '3:2']);
  assert.deepEqual([...new Set(portions.map(portion => portion.day))], [1, 2, 3, 4]);
});

test('Bible goals expose catch-up portions and count only fully completed days', () => {
  const portions = buildPlanPortions({ id: 'TST', verseCounts: [4, 4] }, 3);
  portions[0].completedAt = '2026-07-01T12:00:00Z';
  const plan = { startedOn: '2026-07-01', durationDays: 3, portions };
  assert.equal(countCompletedPlanDays(plan), 1);
  assert.equal(selectCurrentPlanPortion(plan, '2026-07-03')?.day, 2);
});

test('Bible study desk supports highlights, devotionals, and verse notes without changing reading coverage', async () => {
  const [index, ui, data, styles] = await Promise.all([
    readFile(new URL('public/game-preview/index.html', root), 'utf8'),
    readFile(new URL('public/game-preview/rhythm-bible-ui.js', root), 'utf8'),
    readFile(new URL('public/game-preview/data.js', root), 'utf8'),
    readFile(new URL('public/game-preview/game.css', root), 'utf8'),
  ]);
  assert.match(index, /id="bible-selected-label"/);
  assert.match(index, /data-bible-highlight="gold"/);
  assert.match(index, /id="bible-devotional-save"/);
  assert.match(ui, /saveBibleHighlight/);
  assert.match(ui, /saveBibleVerseNote/);
  assert.match(ui, /saveBibleDevotional/);
  assert.match(ui, /selectBibleVerse/);
  assert.match(data, /kind:\s*'bible-highlight'/);
  assert.match(data, /kind:\s*'bible-devotional'/);
  assert.match(data, /row\.completedAt/);
  assert.match(styles, /\.scripture-verse\.mark-gold/);
  assert.match(styles, /\.bible-devotional-grid/);
});

test('focus garden supports timed and untimed covenants with linked reflections', async () => {
  const [index, ui, data] = await Promise.all([
    readFile(new URL('public/game-preview/index.html', root), 'utf8'),
    readFile(new URL('public/game-preview/house-ui.js', root), 'utf8'),
    readFile(new URL('public/game-preview/data.js', root), 'utf8'),
  ]);
  assert.match(index, /data-focus-minutes="0"/);
  assert.match(index, /data-focus-minutes="60"/);
  assert.match(index, /id="focus-achievement"/);
  assert.match(index, /id="focus-benchmark"/);
  for (const type of ['task', 'project', 'prayer', 'scripture', 'book']) {
    assert.match(index, new RegExp(`<option value="${type}">`));
  }
  assert.match(ui, /mode === 'untimed'/);
  assert.match(ui, /prepareFocusCompletion\(true\)/);
  assert.match(ui, /renderLinkedFocusLog\(record\)/);
  assert.match(data, /appendFocusToLinkedRecord/);
  assert.match(data, /focusSecondsTotal/);
  assert.match(data, /latestFocusAchievement/);
});

test('focus rewards are dimensional, botanically annotated, and stream the curated stations privately', async () => {
  const [index, focusGarden, serviceWorker] = await Promise.all([
    readFile(new URL('public/game-preview/index.html', root), 'utf8'),
    readFile(new URL('public/game-preview/focus-garden.js', root), 'utf8'),
    readFile(new URL('public/game-preview/sw.js', root), 'utf8'),
  ]);
  assert.match(index, /MvPgu-hwYQw/);
  assert.match(index, /P-XnYn3FUq4/);
  assert.match(focusGarden, /scientificName/);
  assert.match(focusGarden, /new THREE\.CylinderGeometry/);
  assert.match(focusGarden, /new THREE\.SphereGeometry/);
  assert.match(focusGarden, /reward\.id === 'emmaus-road'/);
  assert.match(serviceWorker, /focus-garden\.js\?v=__BUILD__/);
});

test('main garden has real geometry, earned focus blooms, grass, and an animated waterfall', async () => {
  const game = await readFile(new URL('public/game-preview/game.js', root), 'utf8');
  assert.match(game, /createDimensionalFlower/);
  assert.match(game, /new THREE\.InstancedMesh\(new THREE\.PlaneGeometry\(0\.075, 0\.48\)/);
  assert.match(game, /const waterfall = new THREE\.Group/);
  assert.match(game, /dropletGeometry\.attributes\.position\.needsUpdate = true/);
  assert.match(game, /state\.focusBlooms/);
});

test('Moji can be called from the sanctuary HUD even when passive cameos are off', async () => {
  const [index, ui] = await Promise.all([
    readFile(new URL('public/game-preview/index.html', root), 'utf8'),
    readFile(new URL('public/game-preview/house-ui.js', root), 'utf8'),
  ]);
  assert.match(index, /id="moji-button"/);
  assert.match(ui, /showMoji\('wave'.*\{ force: true \}/s);
  assert.match(ui, /async function showMoji\(action, message, \{ force = false \} = \{\}\)/);
});

test('Nes can use OpenRouter server-side without exposing the key to the client', async () => {
  const [cloudflareNes, localNes, client, config] = await Promise.all([
    readFile(new URL('functions/nes/[[path]].js', root), 'utf8'),
    readFile(new URL('server/nes.js', root), 'utf8'),
    readFile(new URL('public/nes-client.js', root), 'utf8'),
    readFile(new URL('wrangler.jsonc', root), 'utf8'),
  ]);
  assert.match(cloudflareNes, /OPENROUTER_API_KEY/);
  assert.match(cloudflareNes, /https:\/\/openrouter\.ai\/api\/v1\/chat\/completions/);
  assert.match(cloudflareNes, /HTTP-Referer/);
  assert.match(cloudflareNes, /X-OpenRouter-Title/);
  assert.match(localNes, /OPENROUTER_API_KEY/);
  assert.match(localNes, /rule-based-nlu\+openrouter/);
  assert.match(config, /OPENROUTER_MODEL/);
  assert.doesNotMatch(client, /OPENROUTER_API_KEY/);
});
