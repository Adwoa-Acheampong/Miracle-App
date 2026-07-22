# Miracle: The Living House

An immersive, full-screen life game where reflection, breath, gratitude, and real-world action make a living world respond.

This build combines the original repository's fast React interaction model, frosted-glass interface, DM Sans typography, and procedural sound design with the Hobonichi prototype's obsidian-black atmosphere, emerald light, restrained gold accents, and Living House identity.

## Experience

- Responsive canvas world with four interactive landmarks
- Frosted-glass HUD and contextual sheets
- Synthesized water ambience, hover tones, confirmations, and reward sounds
- Local progress for sparks, discoveries, and history
- Reduced-motion support and keyboard-accessible alternatives
- Gemini-backed reflection endpoints with server-side key handling

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
```

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`, then run:

```bash
npm run dev
```

Open the local URL printed by the server.

## Verify

```bash
npm run check
```

This runs the TypeScript check and production build.

## Visual system

- Obsidian: `#050806`
- Black jade: `#0B1711`
- Emerald: `#10B981`
- Bright emerald: `#34D399`
- Miracle gold: `#D7B56D`
- Interface: DM Sans
- Reflective copy: Cormorant Garamond italic
- Numeric detail: JetBrains Mono

Sound remains muted until the player chooses **Wake the House**.
