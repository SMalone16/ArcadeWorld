# PlayCanvas Setup Guide (Teacher Steps)

This assumes your PlayCanvas Editor project and map scene already exist.

## 1) Add script files to PlayCanvas assets

Upload/copy these files from repo folder `client-scripts/`:
- `ArcadeConfig.js`
- `ArcadeNetworkClient.js`
- `LocalPlayerController.js`
- `RemotePlayerManager.js`
- `PlayerAppearance.js`
- `PregameOverlay.js`
- `NetworkDebugOverlay.js`
- `ManhuntManager.js`

## 2) Add Colyseus client library in PlayCanvas

Choose one option:

- **Option A (recommended):** Add external script URL for Colyseus browser client.
- **Option B:** Upload a bundled Colyseus browser build file into assets.

The global `Colyseus` object must be available before `ArcadeNetworkClient.js` runs.

Version compatibility (required for the callback API used by `ArcadeNetworkClient.js`):
- Server packages are pinned to Colyseus 0.16 + Schema 3.x (`@colyseus/core`, `@colyseus/ws-transport`, `@colyseus/schema`).
- In PlayCanvas, load a 0.16 browser client build (for example, a CDN URL under `colyseus.js@0.16.x`) so `Colyseus.getStateCallbacks(room)` is available.

## 3) Configure SERVER_URL for Codespaces

Edit `ArcadeConfig.js`:

```js
window.ArcadeConfig = {
  SERVER_URL: "wss://YOUR-CODESPACES-URL",
  ROOM_NAME: "arcade_lobby",
  PLAYER_NAME_PREFIX: "Student"
};
```

For local server use `ws://localhost:2567`.

## 4) Scene entity setup

### A) Local player entity

1. Create or pick your local player entity (example: `LocalPlayer`).
2. Ensure LocalPlayer parent transform scale is exactly `1,1,1`.
3. Add a **Collision** component set to **Capsule** (do not use Box for the movement body).
4. Add a **Rigidbody** component set to **Dynamic**.
   - Lock rotation with angular factor `0,0,0` (prevents tipping/rolling in first-person).
5. Attach `LocalPlayerController.js` script.
6. Keep visual render/model components on a child entity (not on the LocalPlayer parent physics body).
7. In script attributes:
   - assign `networkManagerEntity` to the `NetworkManager` entity created in step C.
   - assign `cameraEntity` (or place camera as a child named `Camera`).
   - adjust `moveSpeed` if needed.
   - tune jump feel with `minJumpHeight`, `maxJumpHeight`, and `idealJumpHoldTime` (default: hold **Space** for 1 second for the highest jump).
   - optional: leave `enablePointerLock` enabled for FPS mouse look.

### B) Pre-game UI entity

1. Create an empty entity named `PregameUI`.
2. Attach `PregameOverlay.js` script.
3. Set `PregameOverlay.networkClientEntity` to the `NetworkManager` entity from the next section.
4. At launch, this script creates a DOM overlay where players choose a display name, body color, and one of exactly `No Hat`, `Top Hat`, or `Western`.
5. While the overlay is visible, Arcade World stays in the `onboarding` state: pointer lock is released, overlay clicks/typing stay on the DOM UI, and `LocalPlayerController` ignores mouse look and movement input.
6. When the player clicks **Play**, the overlay reads the current input value, trims it (falling back to `Student` only if empty), stores `{ name, color, hatId }` in browser `localStorage` and app state, fires `arcade:profileReady` / `arcade:startGame`, switches the game state to `playing`, requests pointer lock once from that button click, then calls `ArcadeNetworkClient.connectWithProfile(profile)`.

### C) Network manager entity

1. Create an empty entity (example: `NetworkManager`).
2. Attach `ArcadeNetworkClient.js` script.
3. Attach `RemotePlayerManager.js` script.
4. Attach `NetworkDebugOverlay.js` script while running multiplayer playtests. Remove or disable it when you no longer need debug text.
5. In `ArcadeNetworkClient` attributes:
   - set `serverUrl` (or keep empty and provide `window.ArcadeConfig.SERVER_URL`).
   - set `roomName` (or keep empty and provide `window.ArcadeConfig.ROOM_NAME`).
   - set `autoConnect=false` when using the `PregameUI` overlay. Leave the default `true` only for the old instant-join flow.
   - assign `playerTemplate` to your player prefab/template entity (**required**).
   - assign `localPlayerEntity` to `LocalPlayer`.
   - assign `spawnPointsRoot` to your `SpawnPoints` parent.
   - `enableOfflineFallback` can stay enabled so local movement still works when server connection fails.
6. In `RemotePlayerManager` attributes:
   - set `networkClientEntity` to this same `NetworkManager` entity.
   - set `nameplateHeightOffset` if your avatar is taller/shorter than the default 2.2 units.
7. In `NetworkDebugOverlay` attributes:
   - set `networkClientEntity` to this same `NetworkManager` entity.
   - set `remotePlayerManagerEntity` to this same `NetworkManager` entity.

The overlay should display `Connected`, `Session ID`, `Room name`, `Remote players visible`, `Last network error`, and `Server URL`. If both clients show `Connected: yes` but `Remote players visible: 0`, the room is live but remote spawn/update handling still needs investigation.

### D) Level colliders (walls/floor)

For first-person physics collisions:
- Walls/floors should have **Collision** + **Rigidbody (Static)**.
- Local player moves via dynamic rigidbody velocity, so static colliders block motion correctly.

### E) Remote player template and appearance rules

- `RemotePlayerTemplate` should be visual-only for now.
- Do **not** include `LocalPlayerController` on remote template clones.
- Do **not** include a camera on the remote template.
- Each browser client should have exactly one active local camera; remote players should never clone cameras.
- Attach `PlayerAppearance.js` to the template root when possible, or rely on the shared helper loaded from `PlayerAppearance.js`.
- Use this recommended hierarchy for remote visuals and any matching local-player visuals:

```text
RemotePlayerTemplate
  NameTag
  Visual
    Body
    Hats
      No Hat
      Top Hat
      Western
```

- `Body` can use either a Render or Model component. The appearance helper clones body materials before tinting so different players do not share one material.
- `Hats` children must use the exact editor names `No Hat`, `Top Hat`, and `Western`. Missing hat children log a warning instead of crashing.
- Keep `No Hat` enabled by default. `Top Hat` and `Western` can be disabled by default or left for code to toggle at runtime.
- Remote player nametags are DOM-based. They are projected above the remote entity by `RemotePlayerManager` and do not require the existing `NameTag` child to work.

## 5) Launch and verify

1. Press **Launch** in PlayCanvas.
2. Confirm the cursor remains visible and mouse movement does not rotate the camera while the overlay is open. Enter a display name, choose a body color, choose `No Hat`, `Top Hat`, or `Western`, then click **Play**.
3. Open a second tab/device with same launch URL and choose a different profile.
4. Move local player with WASD.
5. Hold and release **Space** to test the charged jump. A 1-second hold should produce the highest jump; shorter or longer holds should still lift the player, but not as high.
6. Verify each client shows `Connected: yes`, a unique `Session ID`, matching `Room name` and `Server URL`, and `Remote players visible: 1` when exactly two clients are connected.
7. Verify the remote avatar appears, updates, uses the selected body color/hat, and shows a DOM nametag above the character.
8. Verify local player collides with walls/floor (no pass-through).

## Troubleshooting

- If no connection: verify `SERVER_URL` is `wss://` and Codespaces port 2567 is visible. Check the debug overlay `Last network error` line first.
- If scripts fail: verify Colyseus client script loaded first.
- If local player does not move: confirm keyboard focus is on the game iframe/tab, `ArcadeNetworkClient.autoConnect=false` when using `PregameUI`, and that you clicked **Play** so the app reaches the `playing` state.
- If the pre-game overlay reports `ArcadeNetworkClient is missing`: confirm `PregameOverlay.networkClientEntity` points to `NetworkManager` and `NetworkManager` has `ArcadeNetworkClient.js` attached.
- If both clients show `Connected: yes` but remote avatars are missing, compare `Remote players visible` across screens. A nonzero count means the manager spawned a remote entity that may be hidden, scaled incorrectly, or outside camera view; zero means the client did not receive/spawn remote state.
- If you see `[ArcadeNetworkClient] Connection failed` with `Cannot read properties of undefined (reading 'onAdd')`: this means `room.state.players` is missing on the client. Re-upload the latest `ArcadeNetworkClient.js` (which guards before binding listeners) and confirm your server room calls `this.setState(new ArcadeWorldState())` and initializes `players` as a `MapSchema`.

## TODO (future)

- Replace placeholder avatars with student-customizable characters.
- Add cabinet interactions, tickets, and shop logic.

## 6) Manhunt / Hide-and-Seek multiplayer setup

Manhunt uses a hybrid classroom-playtest model: local movement is client-authoritative for smooth feel, while the Colyseus room remains authoritative for round phase, team assignments, safe/tagged status, points, rule validation, and explicit server teleports. PlayCanvas clients send movement snapshots for server-side Manhunt checks and render synchronized state from the room schema.

### Scripts to attach or update

- Attach `ManhuntManager.js` to a `GameModeManager` entity or to the existing `NetworkManager` entity.
  - Assign `networkManagerEntity`, `remotePlayerManagerEntity`, `localPlayerEntity`, and `safeZoneEntity` in the Editor.
  - The `safeZoneEntity` field must point to the actual visible SafeZone/Home Base entity, not the `GameModeManager` entity.
  - The client-side safe-zone check is only immediate feedback for pressing **M** outside Home Base; the server still enforces the real start restriction from server-tracked player positions.
  - The right-side Manhunt HUD is student-facing and shows phase, team badge, timer, objective, hider safe/tagged counts, points, and the latest server message.
  - The center overlay shows team reveal, synchronized countdown, phase-change instructions, and readable round-over results.
- `ArcadeNetworkClient.js` listens to the server `manhunt` schema plus Manhunt feedback messages.
  - It exposes `getManhuntState()`, `getLocalManhuntTeam()`, `getLocalManhuntStatus()`, `getPlayerManhuntTeam(sessionId)`, `getPlayerDisplayName(sessionId)`, `isManhuntActive()`, `sendManhuntStartRequest()`, and `sendManhuntTagRequest()` for UI and nameplate code.
  - It applies local player position changes only when the server increments `serverTeleportId`, so normal server movement echoes do not fight local physics.
  - Enable `showMovementDebug` temporarily to display local velocity/position, the server-known local position, local/server difference, teleport id, and remote interpolation distance in-game.
- `RemotePlayerManager.js` keeps DOM nameplates, applies Manhunt visibility rules, and interpolates remote avatars toward their latest server targets. Large jumps or changed `serverTeleportId` snap immediately.
  - In lobby/free roam and round-over results, all nametags may be shown.
  - During `countdown`, `hidingPhase`, and `seekingPhase`, remote nametags are shown only for same-team players and are hidden for opponents.
- Keep `LocalPlayerController.js` on the local player for movement. It continues sending movement packets at a fixed interval, applies a local seeker movement lock during `countdown`/`hidingPhase`, and only accepts explicit server teleports instead of continuous position correction.

### Server expectations

- Run the Colyseus server from `/server` so clients join the shared `arcade_lobby` room.
- The room schema contains `state.manhunt` with phases `lobby`, `countdown`, `hidingPhase`, `seekingPhase`, and `roundOver`.
- Each `PlayerState` includes `manhuntTeam`, `manhuntStatus`, `manhuntPoints`, `totalPoints`, `isInManhuntRound`, and `serverTeleportId`.
- Clients send:
  - `manhunt:startRequest` when the player presses **M** at Home Base.
  - `manhunt:tagRequest` when a seeker presses **E** during the seeking phase.
  - `debug:playerPositionCapture` when a player presses **P** to print the local player root position in the server terminal.
- The server validates player count, Home Base distance, seeker/hider roles, tag distance, safe-zone entry, scoring, and round reset.
- The server owns the real Home Base validation and the real Manhunt spawn destinations. It cannot read PlayCanvas scene entities or collision components, so it only trusts `LobbyRoom.ts` Manhunt coordinates and player positions received through movement packets.

### Entities to create or update

- `ManhuntSafeZone`
  - Add a visible flat cylinder/disc or transparent marker at the Home Base location.
  - Match this visible marker to the server safe-zone coordinates in `server/src/rooms/LobbyRoom.ts` (`MANHUNT_HOME_BASE` and `MANHUNT_SAFE_ZONE_RADIUS`). The current server Home Base is `x=276.6`, `y=-0.19`, `z=-222`, with radius `15`.
  - Keep the visible SafeZone entity coordinates in PlayCanvas synchronized with these server values whenever the scene marker moves.
- Spawn transforms
  - Hider, seeker, and lobby spawn positions are server-authoritative constants in `server/src/rooms/LobbyRoom.ts`: `MANHUNT_HIDER_START`, `MANHUNT_SEEKER_START`, and `MANHUNT_LOBBY_SPAWN`. These must match the PlayCanvas world positions of the visible editor markers named `HiderStart`, `SeekerStart`, and `LobbySpawn`.
  - The PlayCanvas marker/collider entities are useful for local prompts and for students to see the setup, but they are not final server authority. Best practice for now is: PlayCanvas marker/collider = visual/local prompt, server constants/config = authoritative interaction/spawn truth, and both must be kept in sync.
  - If players fall through the floor after a server teleport, the spawn root is probably at or below the floor surface, or the marker is over scenery without a collision/static rigidbody. Move the marker to a walkable collision surface and capture the LocalPlayer root Y while standing there.
  - `LobbyRoom.ts` currently applies a temporary `SPAWN_VERTICAL_SAFETY_OFFSET` to Manhunt spawns so player roots do not appear exactly on the visible floor. Replace that temporary lift with exact root-height marker coordinates after capture.
- Player prefab/local player
  - Keep the root entity at scale `1,1,1` for gameplay/physics.
  - Put body visuals under a child named `AvatarVisual` or `Visual`.
  - Put camera/head under a separate child so squash/stretch does not move or resize the collider.

### Current controls

- Gather at Home Base / the safe zone, then press **M** to request a server-authoritative Manhunt round.
- Pressing **M** outside Home Base shows "Go to Home Base to start Manhunt" locally, and the server also rejects invalid starts.
- Press **E** as the seeker during the seeking phase to ask the server to tag the nearest active hider within range.
- Press **P** while standing at an intended Manhunt marker to capture the local player root position. The client sends `debug:playerPositionCapture`, and the server logs `[ManhuntDebug] Position capture from ...: x, y, z`. Copy those values from the Codespace terminal into `MANHUNT_HIDER_START`, `MANHUNT_SEEKER_START`, or `MANHUNT_LOBBY_SPAWN` in `server/src/rooms/LobbyRoom.ts`.
- Press **Shift** to sprint.
- Press **Space** to jump.
