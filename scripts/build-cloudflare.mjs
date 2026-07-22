import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const buildToken = process.env.CF_PAGES_COMMIT_SHA
  || process.env.BUILD_TOKEN
  || `cf-${Date.now()}`;

const CSS_ORDER = [
  'tokens.css', 'themes.css', 'base.css', 'layout.css', 'components.css',
  'book.css', 'motion.css', 'domains.css', 'micro.css', 'mobile.css',
  'rewards.css', 'sidebar.css', 'dashboard.css', 'finance.css', 'editorial.css',
  'bitmoji.css', 'focus.css', 'features.css', 'brand.css', 'redesign.css', 'system.css',
];

await fs.rm(distDir, { recursive: true, force: true });
await fs.cp(publicDir, distDir, { recursive: true });

const css = await Promise.all(CSS_ORDER.map(async name => {
  const text = await fs.readFile(path.join(publicDir, 'styles', name), 'utf8');
  return `/* --- ${name} --- */\n${text}`;
}));
await fs.mkdir(path.join(distDir, 'styles'), { recursive: true });
await fs.writeFile(path.join(distDir, 'styles', 'bundle.css'), css.join('\n\n'));

const gameModuleFiles = (await fs.readdir(path.join(distDir, 'game-preview')))
  .filter(name => name.endsWith('.js'))
  .map(name => `game-preview/${name}`);

for (const rel of ['index.html', 'sw.js', 'game-preview/index.html', ...gameModuleFiles]) {
  const file = path.join(distDir, rel);
  const text = await fs.readFile(file, 'utf8');
  await fs.writeFile(file, text.replaceAll('__BUILD__', buildToken));
}

await fs.writeFile(
  path.join(distDir, 'build.json'),
  `${JSON.stringify({ build: buildToken, builtAt: new Date().toISOString() })}\n`,
);

await fs.writeFile(path.join(distDir, '_headers'), `
/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/sw.js
  Cache-Control: no-cache, no-store, must-revalidate

/game-preview/sw.js
  Cache-Control: no-cache, no-store, must-revalidate

/game-preview/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/game-preview/*
  Cache-Control: no-cache, max-age=0, must-revalidate

/build.json
  Cache-Control: no-cache, no-store, must-revalidate

/styles/bundle.css
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`.trimStart());

await fs.writeFile(path.join(distDir, '_redirects'), `
/ /game-preview/ 302
`.trimStart());

console.log(`Built Cloudflare Pages output in dist/ (${buildToken})`);
