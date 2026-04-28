# Arcade World (PlayCanvas + Colyseus)

Arcade World is a **live online virtual arcade for students**.

This repository now includes:
- A **Colyseus multiplayer server** (`/server`) for the shared lobby.
- **PlayCanvas-ready client scripts** (`/client-scripts`) you upload into your existing PlayCanvas Editor project.
- Teacher-friendly setup/testing docs for **GitHub Codespaces**.

> Today's goal: get multiple players moving in the same PlayCanvas map **today**.

---

## What works in this vertical slice

1. Players join one shared lobby room (`arcade_lobby`).
2. Multiple players connect to the same Colyseus server.
3. Each player moves in the PlayCanvas scene with WASD.
4. Other players appear as simple placeholder avatars.
5. Movement is synchronized through the server.

### Not implemented yet (intentionally)

- Tickets economy
- Shop
- Arcade machine gameplay handoff
- Hide & Seek mode

These are explicitly deferred with TODO markers in docs/scripts.

---

## Repository structure

```text
.
├── AGENTS.md
├── client-scripts/
│   ├── ArcadeConfig.js
│   ├── ArcadeNetworkClient.js
│   ├── LocalPlayerController.js
│   ├── RemotePlayerManager.js
│   └── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CODESPACES_TESTING.md
│   ├── PLAYCANVAS_SETUP.md
│   └── STUDENT_EXPLANATION.md
└── server/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── rooms/
        │   └── LobbyRoom.ts
        └── schema/
            ├── ArcadeWorldState.ts
            └── PlayerState.ts
```

---

## Quick start (Codespaces server test flow)

### 1) Run server in GitHub Codespaces

```bash
cd server
npm install
npm run dev
```

Expected output includes server listening on **port 2567**.

### 2) Forward port 2567

In Codespaces:
1. Open the **PORTS** tab.
2. Find port `2567`.
3. Set visibility to **Public** or **Organization** (school policy dependent).
4. Copy forwarded URL (usually `https://<name>-2567.app.github.dev`).

### 3) Convert HTTP URL to WebSocket URL

Convert like this:

- `https://example-2567.app.github.dev`
- becomes
- `wss://example-2567.app.github.dev`

### 4) Put URL in `client-scripts/ArcadeConfig.js`

```js
window.ArcadeConfig = {
  SERVER_URL: "wss://example-2567.app.github.dev",
  ROOM_NAME: "arcade_lobby",
  PLAYER_NAME_PREFIX: "Student"
};
```

### 5) Upload scripts into PlayCanvas and attach them

Follow `docs/PLAYCANVAS_SETUP.md` exactly.

### 6) Test with two tabs or devices

- Launch PlayCanvas project in Browser Tab A
- Launch again in Browser Tab B (or second device)
- Move both players with WASD
- Confirm each tab sees the other avatar moving

---

## Local development (optional)

Run server locally:

```bash
cd server
npm install
npm run dev
```

Use `ws://localhost:2567` in `ArcadeConfig.js`.

---

## Documentation index

- `docs/PLAYCANVAS_SETUP.md` - exact editor entity/script setup steps
- `docs/CODESPACES_TESTING.md` - full Codespaces multiplayer test guide
- `docs/STUDENT_EXPLANATION.md` - classroom-friendly explanation
- `docs/ARCHITECTURE.md` - boundaries and future expansion plan

---

## Notes for teachers

- You do **not** need Unity.
- You do **not** need a desktop IDE.
- PlayCanvas scene visuals remain managed in PlayCanvas Editor.
- Codespaces is for **today's testing workflow**, not long-term production hosting.
