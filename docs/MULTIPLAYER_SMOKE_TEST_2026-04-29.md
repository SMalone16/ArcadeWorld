# Multiplayer Smoke Test Report — 2026-04-29

> Historical note: this report captured the state on **2026-04-29**. It is no longer a current-state document. The current PlayCanvas Editor path now has a Colyseus client script set in `client-scripts/`, and the current setup/test instructions live in `docs/PLAYCANVAS_SETUP.md` and `docs/CODESPACES_TESTING.md`.

## Scope tested on 2026-04-29

Requested validation:

1. Two browser instances connect to the same room/session.
2. Each user sees self as local-owned cube and other users as remote cubes.
3. Each user has independent first-person camera control.
4. Late join, disconnect, reconnect spawn/despawn correctness.
5. No duplicate local input control on remote proxies.
6. Record known issues and target fixes.

## Environment used

- Date: 2026-04-29 (UTC)
- Repo: `ArcadeWorld`
- Client runtime: Vite + PlayCanvas static prototype
- Server runtime available: Colyseus room in `server/`

## Result summary from that date

### 1) Two browser instances connect to same room/session

**Status on 2026-04-29: BLOCKED.**

Reason at that time:

- The static TypeScript client was bound to `LocalMockNetworkClient` through `createNetworkClient()`.
- It did not create a Colyseus WebSocket room connection.
- The local mock spawned one synthetic remote proxy (`mock-client-2`) rather than synchronizing real peers.

### 2) Local-owned cube vs remote cubes

**Status on 2026-04-29: PARTIALLY VERIFIED in single-process mock mode.**

Verified in code at that time:

- The mock local player was spawned with `isOwner: true`.
- The synthetic remote proxy was spawned with `isOwner: false`.
- `PlayerPrefab` enabled the camera for owner only and disabled non-owner camera components.

### 3) Independent first-person camera control per user

**Status on 2026-04-29: BLOCKED end-to-end / PARTIALLY VERIFIED by architecture.**

Verified in code at that time:

- The game created a single `PlayerController` bound to local client entity ID `local-client-1`.
- Non-owner players did not have active cameras.

### 4) Late join, disconnect, reconnect spawn/despawn correctness

**Status on 2026-04-29: BLOCKED end-to-end / PARTIALLY VERIFIED by server and mock lifecycle methods.**

Verified in code at that time:

- Server room added players on join and removed them on leave.
- Mock client supported despawn-on-leave and disconnect cleanup.

### 5) No duplicate local input control on remote proxies

**Status on 2026-04-29: PARTIALLY VERIFIED in single-process mock mode.**

Verified in code at that time:

- Local input flow (`sendInput`) was applied from local entity state and forwarded as snapshots to remote proxy buffers.
- Only one `PlayerController` instance was created for the local entity in `ArcadeGame`.

## Current follow-up status

The largest blocker recorded in this historical report has been addressed for the **PlayCanvas Editor playtest path** by adding `client-scripts/ArcadeNetworkClient.js`, `RemotePlayerManager.js`, profile/appearance scripts, Manhunt scripts, ticket scripts, and the `/server` Colyseus room/schema work.

Still needed:

1. A fresh smoke-test report for the current PlayCanvas + Colyseus path.
2. Automated or semi-automated multi-browser validation.
3. Reconnect/rehydration behavior beyond simple join/leave.
4. Private classroom room IDs and moderation controls.

## Commands executed for the historical validation

```bash
npm run build
npm --prefix server run build
```
