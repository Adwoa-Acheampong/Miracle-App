// One-time SVG → PNG converter for the social share card.
// Usage:
//   npm install --no-save @resvg/resvg-js
//   node scripts/build-og-png.mjs
//
// Produces:
//   public/assets/og-card.png   (1200×630, PNG)
//
// PNG is what Facebook, Twitter/X, WhatsApp, LinkedIn, iMessage all
// reliably render. SVG OG images are supported by some clients but not
// the major social platforms — so we ship a baked PNG as the canonical
// share image and keep the SVG around as the source of truth.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SVG_PATH = resolve(__dirname, '..', 'public', 'assets', 'og-card.svg');
const PNG_PATH = resolve(__dirname, '..', 'public', 'assets', 'og-card.png');

const svg = readFileSync(SVG_PATH, 'utf8');

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  background: '#0A0A0C',
  font: {
    loadSystemFonts: true,
    defaultFontFamily: 'Helvetica',
  },
});

const pngBuffer = resvg.render().asPng();
writeFileSync(PNG_PATH, pngBuffer);

console.log(`✓ wrote ${PNG_PATH}`);
console.log(`  ${(pngBuffer.length / 1024).toFixed(1)} KB`);
