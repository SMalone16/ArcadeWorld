# Arcade World

Arcade World is a browser-based 2.5D multiplayer virtual arcade prototype built with **PlayCanvas + TypeScript + Vite**. The project starts as a clean client foundation for a shared online lobby where players can walk around, approach arcade cabinets, and launch mini-games.

## Project Overview

- **Platform:** Web browser only (no native app dependency).
- **Client Engine:** PlayCanvas.
- **Build Tooling:** Vite + TypeScript.
- **Current Networking:** Local mock client abstraction.
- **Future Networking Plan:** Node.js multiplayer backend (likely Colyseus), separate from static client hosting.

## Quick Start

```bash
npm install
npm run dev
```

Open the local URL shown by Vite (typically `http://localhost:5173`).

## Scripts

- `npm run dev` - start local development server.
- `npm run build` - type-check and generate production build in `dist/`.
- `npm run preview` - preview production build locally.

## Current Status

✅ Implemented in this initial scaffold:
- PlayCanvas app bootstrap and render canvas.
- Basic placeholder lobby scene using primitive geometry.
- WASD player movement with a follow camera.
- Interactable arcade cabinets with E-key prompt + mini-game launch stub.
- Mini-game registry and one example mini-game placeholder.
- Mock network client abstraction for future server integration.
- Foundational docs + Codex agent guidance.


## Engineering Review Notes

Current status after repository review:

- Folder structure is clear for current scope, but scene composition can grow quickly; keep spawn/layout data in dedicated modules (`src/scenes/lobbyLayout.ts`) instead of embedding arrays directly in scene classes.
- Networking boundaries are mostly clean (`src/network` + factory), but scene/entity code should continue avoiding direct socket/session references.
- PlayCanvas-specific setup is still centralized in scene/entity classes; as complexity grows, prefer lightweight factory/helper modules for reusable materials and primitive builders.
- GitHub Pages deployment remains realistic for the client, but multiplayer must stay in a separate service as documented in `docs/DEPLOYMENT.md`.
- Build currently succeeds, but production bundle size is large (~1.9 MB minified JS). Plan for code-splitting when mini-games become real modules.

## Multiplayer Plan (Future)

- Keep client as static assets deployable to GitHub Pages.
- Introduce a **separate Node.js server** deployment for real-time sessions/state.
- Likely backend stack: Colyseus + WebSocket transport.
- Keep rendering/gameplay code decoupled from networking code.

## Deployment Plan

- **Client:** GitHub Pages (static build output from `dist/`).
- **Server:** Dedicated host (e.g., Render, Railway, Fly.io, AWS, GCP, Azure).
- **Important:** GitHub Pages cannot host persistent multiplayer WebSocket servers.

See `docs/DEPLOYMENT.md` for details.

## Folder Structure

```text
.
├── AGENTS.md
├── docs/
├── public/
├── src/
│   ├── assets/
│   ├── entities/
│   ├── game/
│   ├── minigames/
│   ├── network/
│   ├── scenes/
│   └── ui/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```
