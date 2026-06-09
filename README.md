# Arcade World (PlayCanvas + Colyseus)

Arcade World is a **school-friendly, browser-based virtual arcade**. The current project has two complementary client paths:

- **PlayCanvas Editor playtest path (`client-scripts/`)**: upload these JavaScript scripts into an existing PlayCanvas scene and connect to the Colyseus server in `/server` for real shared-lobby playtests.
- **Static Vite/TypeScript prototype (`src/`)**: a GitHub-Pages-compatible local scaffold that builds a simple lobby, mock players, cabinet interactions, and a local Manhunt prototype for architecture/testing without needing the PlayCanvas Editor.

---

## What works now

### PlayCanvas + Colyseus classroom playtest

1. Players join the shared Colyseus room named `arcade_lobby`.
2. Each player chooses a display name, body color, and hat in the pre-game overlay.
3. Local movement uses WASD, mouse look, Shift sprint, and Space jump.
4. Remote players spawn, despawn, interpolate, show DOM nametags, and use synchronized appearance data.
5. The server tracks player room state, transform snapshots, profile data, Manhunt state, and ticket pickups.
6. Server-authoritative Manhunt rounds can be started at Home Base with **M** when at least two players are connected.
7. A free-roam ticket pickup prototype supports 16 configured spawn candidates, 10 active tickets, server-validated collection, short respawns, and a ticket leaderboard/debug overlay.

### Static Vite/TypeScript prototype

1. `npm run dev` starts a static PlayCanvas app served by Vite.
2. `src/scenes/LobbyScene.ts` builds a simple 2.5D lobby with cabinets, spawn points, and a Manhunt safe-zone marker.
3. `src/network/LocalMockNetworkClient.ts` spawns a local player plus a synthetic remote proxy so movement/interpolation and UI wiring can be exercised without a WebSocket server.
4. The mini-game registry currently contains an example mini-game placeholder.

---

## Not implemented yet / intentionally incomplete

- Production hosting for the multiplayer server.
- Authentication, moderation tools, private classroom room codes, and reconnect/rehydration flows.
- Shop/cosmetic purchasing and persistent accounts.
- Real cabinet-to-mini-game handoff in the PlayCanvas Editor scene.
- Server-authoritative map loading for Manhunt; the current PlayCanvas marker bridge is intentionally a classroom/dev convenience.

---

## Repository structure

```text
.
├── AGENTS.md
├── client-scripts/              # JavaScript files uploaded into PlayCanvas Editor
│   ├── ArcadeConfig.js
│   ├── ArcadeNetworkClient.js
│   ├── LocalPlayerController.js
│   ├── RemotePlayerManager.js
│   ├── PlayerAppearance.js
│   ├── PregameOverlay.js
│   ├── NetworkDebugOverlay.js
│   ├── ManhuntManager.js
│   ├── ManhuntMapConfig.js
│   ├── TicketPickupManager.js
│   ├── TicketLeaderboard.js
│   └── TicketCollectibleVisual.js
├── docs/                        # Architecture, setup, deployment, and classroom docs
├── server/                      # Colyseus authoritative room server
│   └── src/
│       ├── index.ts
│       ├── rooms/LobbyRoom.ts
│       └── schema/
└── src/                         # Static Vite/TypeScript prototype client
    ├── entities/
    ├── events/
    ├── game/
    ├── minigames/
    ├── network/
    ├── scenes/
    └── ui/
```

---

## Quick start: static prototype

```bash
npm install
npm run dev
```

Open the Vite URL in a browser. This path uses mock networking and is suitable for checking the static lobby scaffold and TypeScript build.

Build the static client:

```bash
npm run build
```

---

## Quick start: Codespaces multiplayer playtest

### 1) Run the server

```bash
cd server
npm install
npm run dev
```

Expected output includes Colyseus listening on **port 2567** and room `arcade_lobby`.

### 2) Forward port 2567

In Codespaces:

1. Open the **PORTS** tab.
2. Find port `2567`.
3. Set visibility to **Public** or **Organization** depending on school policy.
4. Copy the forwarded URL, usually `https://<name>-2567.app.github.dev`.

### 3) Convert the URL for WebSockets

Convert like this:

- `https://example-2567.app.github.dev`
- becomes
- `wss://example-2567.app.github.dev`

### 4) Put the URL in `client-scripts/ArcadeConfig.js`

```js
window.ArcadeConfig = {
  SERVER_URL: "wss://example-2567.app.github.dev",
  ROOM_NAME: "arcade_lobby",
  PLAYER_NAME_PREFIX: "Student"
};
```

For a local server, use `ws://localhost:2567`.

### 5) Upload scripts into PlayCanvas and attach them

Follow `docs/PLAYCANVAS_SETUP.md` exactly. It includes the required script attributes for networking, profile selection, Manhunt markers, ticket pickups, and debug overlays.

### 6) Test with two tabs or devices

- Launch the PlayCanvas project in Browser Tab A.
- Launch it again in Browser Tab B or on a second device.
- Pick different player profiles.
- Move both players with WASD.
- Confirm each tab sees the other avatar moving.
- Optional: start Manhunt at Home Base with **M**, tag as seeker with **E**, and check ticket pickup/leaderboard behavior.

---

## Documentation index

- `docs/ARCHITECTURE.md` - current code boundaries and runtime responsibilities.
- `docs/PLAYCANVAS_SETUP.md` - exact PlayCanvas Editor entity/script setup steps.
- `docs/CODESPACES_TESTING.md` - Codespaces multiplayer test guide.
- `docs/DEPLOYMENT.md` - static client vs long-running WebSocket server deployment guidance.
- `docs/ROADMAP.md` - current phases and next work.
- `docs/STUDENT_EXPLANATION.md` - classroom-friendly explanation.
- `docs/ASSET_PIPELINE.md` - source/runtime asset workflow.

---

## Notes for teachers

- PlayCanvas scene visuals remain managed in PlayCanvas Editor.
- Codespaces is useful for development and classroom testing, not long-term production hosting.
- The client can be statically hosted, but real-time multiplayer requires the Node/Colyseus server to run separately.
