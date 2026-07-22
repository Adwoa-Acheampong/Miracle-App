# Miracle: The Living House

Miracle is an immersive, room-based life game for faith, work, care, and memory. The original Hobonichi game is the source of truth: the 3D Morning Gate, physical doors, Atrium, Chapel, Workshop, Garden, Archive, progression systems, local data, account sync, notifications, and installable PWA all remain intact.

The interface combines that complete game with an integrated frosted-glass design system: obsidian and emerald light, Cormorant Garamond display type, DM Sans controls, JetBrains Mono data, synthesized ambience, hover tones, room travel sounds, and reward audio.

## Run locally

Node 20 or newer is required.

```powershell
npm install
$env:PORT=3000
npm run dev
```

Open `http://127.0.0.1:3000/`. The root route opens the Living House at `/game-preview/`. On localhost, the auth screen offers local test mode so the complete game can be previewed without a database account.

For the static Cloudflare Pages build:

```powershell
npm run build:cloudflare
npx wrangler pages dev dist --port 3000
```

## What is included

- Three.js Morning Gate, Atrium, animated doors, and four dedicated room builders
- Chapel: prayer, Scripture, fasting, testimony, and Bible reading plans
- Workshop: tasks, projects, plans, ideas, focus sessions, and scheduling
- Garden: health, meals, people, dreams, and care practices
- Archive: journal, living book, finance, search, memory, and reflection
- Full public-domain WEB-C Bible corpus: 73 books, including Tobit and the deuterocanon
- IndexedDB offline storage, account auth, sync APIs, email flows, and MySQL/D1 schemas
- PWA install, offline cache, background sync, update prompts, push notifications, and reminders worker
- Frosted-glass UI, black/emerald gradient, responsive layouts, reduced-motion support, hover audio, ambient water, door, travel, confirm, error, focus, and reward sounds

## Project layout

```text
public/game-preview/   Living House UI, Three.js world, systems, PWA, and Bible corpus
public/                Shared storage, auth, icons, attachments, user, and life-domain modules
server/                Express, MySQL, auth, sync, email, and Nes backend
functions/             Cloudflare Pages Functions equivalents
migrations/            D1 schema migrations
workers/reminders/     Push reminder worker
scripts/               Cloudflare build and data-generation scripts
test/                  Game, PWA, database, and utility tests
```

## Verify

```powershell
npm test
npm run build:cloudflare
```

Generated screenshots, browser traces, temporary archives, and build output are intentionally excluded from version control. The game data and complete Bible corpus are versioned because they are runtime content, not test artifacts.
