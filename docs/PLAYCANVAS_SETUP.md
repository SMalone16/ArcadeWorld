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
- `InteractionPrompt.js`
- `TicketSnakeGame.js`
- `ArcadeCabinetGameLauncher.js`
- `ManhuntManager.js`
- `ManhuntMapConfig.js`
- `TicketPickupManager.js`
- `FreeRoamStatusHud.js`
- `TicketLeaderboard.js`
- `TicketCollectibleVisual.js`

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
- Add production cabinet interactions, shop logic, and persistent account-backed ticket balances.


## 6) Shared interaction prompt and Ticket Snake cabinet

The centered prompt is DOM-based and reused by cabinet play and Manhunt tagging. It does not block input (`pointer-events: none`) and is automatically hidden during onboarding/pregame UI and while the Ticket Snake overlay is active.

1. Upload these scripts with the rest of the client scripts:
   - `InteractionPrompt.js`
   - `TicketSnakeGame.js`
   - `ArcadeCabinetGameLauncher.js`
2. Attach `InteractionPrompt.js` once to an always-enabled entity such as `GameModeManager` or `NetworkManager`. No art assets are required.
3. Select your arcade cabinet entity, or create an empty helper entity positioned at the cabinet. Attach `ArcadeCabinetGameLauncher.js`.
4. In `ArcadeCabinetGameLauncher` attributes:
   - Set `networkManagerEntity` to the entity running `ArcadeNetworkClient.js`.
   - Set `localPlayerEntity` to `LocalPlayer`.
   - Leave `cabinetEntity` empty if the script is on the cabinet; otherwise assign the actual cabinet entity.
   - Start with `interactionRadius=2.5`. Increase slightly if the prompt feels hard to trigger.
   - Leave `promptText` as `Press E to Play` unless you want classroom-specific wording.
5. Test the cabinet:
   - Join through the pregame UI so Arcade World is in `playing`.
   - Walk away from the cabinet and confirm no prompt is visible.
   - Walk within the radius and confirm the centered `Press E to Play` prompt appears around the lower-middle of the viewport.
   - Press **E**. Ticket Snake should open over the current PlayCanvas scene without changing scenes or loading assets.
   - Press **Space** to start, steer with **WASD** or **Arrow Keys**, crash into a wall/self to end, then press **E** to return to the same scene.
6. Ticket rewards:
   - The client displays the expected Ticket Snake reward from the score bands: 0 = 1, 1–2 = 2, 3–4 = 4, 5–7 = 6, 8–11 = 8, 12+ = 10.
   - The client sends `tickets:awardFromMiniGame` with `{ source: "ticket-snake", score, tickets }`.
   - The Colyseus server verifies the player exists, floors and clamps the award to 1–10, increments `player.tickets`, and replies with `tickets:miniGameAwarded`. Existing ticket leaderboard/local saved-ticket callbacks then refresh from room state.

## 7) Manhunt / Hide-and-Seek multiplayer setup

Manhunt uses a hybrid classroom-playtest model: local movement is client-authoritative for smooth feel, while the Colyseus room remains authoritative for round phase, team assignments, safe/tagged status, points, rule validation, and explicit server teleports. PlayCanvas clients send movement snapshots for server-side Manhunt checks and render synchronized state from the room schema.

### Scripts to attach or update

- Attach `ManhuntManager.js` to a `GameModeManager` entity or to the existing `NetworkManager` entity.
  - Assign `networkManagerEntity`, `remotePlayerManagerEntity`, `localPlayerEntity`, `safeZoneEntity`, `mainCameraEntity`, and `spectatorCameraEntity` in the Editor.
  - Optional: assign `tagSfxEntity` to an entity with a **Sound** component and a sound slot named `tagPop` for server-confirmed tag pop audio.
  - The `safeZoneEntity` field must point to the actual visible SafeZone/Home Base entity, not the `GameModeManager` entity.
  - The `mainCameraEntity` should be the normal local gameplay camera. The `spectatorCameraEntity` should be a separate camera looking at Home Base and should start disabled.
  - The client-side safe-zone check is only immediate feedback for pressing **M** outside Home Base; the server still enforces the real start restriction from server-tracked player positions.
  - The Manhunt UI is state-driven and renders separate layers: center overlay, bottom role badge, top-right task panel, top-center timer, scoreboard overlay, spectator overlay, plus an automatic bottom-left action feed (last 5 round actions).
  - Tagged players also get a 2-second personal center-screen message ("You were tagged by ...") driven by server action events.
  - The center overlay is intentionally short-lived: it appears for team reveal, spawn countdown, feedback, and round-over results, then disappears during the active round.
- Attach `ManhuntMapConfig.js` to the same `GameModeManager` entity to send PlayCanvas marker positions to the server while the room is still in the Manhunt `lobby` phase.
  - This is a dev/classroom bridge only. Production server-authoritative games should use a trusted shared map config file or server-loaded map data instead of trusting a client-sent config.
- `ArcadeNetworkClient.js` listens to the server `manhunt` schema plus Manhunt feedback messages.
  - It exposes `getManhuntState()`, `getLocalManhuntTeam()`, `getLocalManhuntStatus()`, `getPlayerManhuntTeam(sessionId)`, `getPlayerDisplayName(sessionId)`, `isManhuntActive()`, `sendManhuntStartRequest()`, `sendManhuntTagRequest()`, and `sendManhuntMapConfig(config)` for UI, nameplate, and marker-config code.
  - It applies local player position changes only when the server increments `serverTeleportId`, so normal server movement echoes do not fight local physics.
  - Enable `showMovementDebug` temporarily to display local velocity/position, the server-known local position, local/server difference, teleport id, and remote interpolation distance in-game.
- `RemotePlayerManager.js` keeps DOM nameplates, applies Manhunt visibility rules, and interpolates remote avatars toward their latest server targets. Large jumps or changed `serverTeleportId` snap immediately.
  - In lobby/free roam, all nametags are shown.
  - During `teamReveal`, `spawnCountdown`, and `activeRound`, remote nametags are shown only for same-team active players and are hidden for opponents, tagged hiders, and safe hiders.
  - During `roundOver`, nametags are hidden while the scoreboard/spectator view is active; they return when the server resets to `lobby`.
- Keep `LocalPlayerController.js` on the local player for movement. It continues sending movement packets at a fixed interval, locks local movement during Manhunt control-locked phases/statuses, and only accepts explicit server teleports instead of continuous position correction.

### Server expectations

- Run the Colyseus server from `/server` so clients join the shared `arcade_lobby` room.
- The room schema contains `state.manhunt` with phases `lobby`, `teamReveal`, `spawnCountdown`, `activeRound`, and `roundOver`.
- Timing constants in `server/src/rooms/LobbyRoom.ts` are `TEAM_REVEAL_SECONDS = 5`, `ROUND_START_COUNTDOWN_SECONDS = 5`, `ACTIVE_ROUND_SECONDS = 60`, and `ROUND_OVER_SECONDS = 30`.
- Each `PlayerState` includes `manhuntTeam`, `manhuntStatus`, `manhuntPoints`, `totalPoints`, `isInManhuntRound`, and `serverTeleportId`.
- Clients send:
  - `manhunt:startRequest` when the player presses **M** at Home Base during lobby/free roam.
  - `manhunt:tagRequest` when a seeker presses **E** during `activeRound`. The centered `Press E to Tag` prompt is client-side only; the server remains authoritative for whether the tag is allowed.
  - `debug:playerPositionCapture` when a player presses **P** to print the local player root position in the server terminal.
- The server validates player count, Home Base distance, seeker/hider roles, tag distance, safe-zone entry, scoring, movement locks, and round reset.
- The server owns the real Home Base validation and the real Manhunt spawn destinations. For dev/classroom playtests, `ManhuntMapConfig.js` can send editor marker positions before a round starts; if that bridge is disabled or no config arrives, the server falls back to its hardcoded defaults.

### Manhunt Marker Setup

This setup removes the old copy/paste loop for classroom playtests: you can move marker entities visually in the PlayCanvas Editor, and `ManhuntMapConfig.js` sends their world-space transforms to the Colyseus server before a round starts. The server stores those values in `state.manhunt` and uses them for authoritative spawn, Home Base, and safe-zone checks during gameplay.

1. Create empty/non-rendered marker entities in PlayCanvas:
   - `ManhuntSafeZone`
   - `SeekerSpawn`
   - `HiderSpawnA`
   - `HiderSpawnB`
   - `HiderSpawnC`
   - `LobbySpawn`
   - `SpectatorCamera` (optional camera/marker used by spectator mode)
2. Add `ManhuntMapConfig.js` to your `GameModeManager` entity.
3. In the Inspector, assign:
   - `networkManagerEntity` to the entity running `ArcadeNetworkClient.js`.
   - `safeZoneEntity` to `ManhuntSafeZone`.
   - `seekerSpawnEntity` to `SeekerSpawn`.
   - `hiderSpawnAEntity`, `hiderSpawnBEntity`, and `hiderSpawnCEntity` to the three hider markers.
   - `lobbySpawnEntity` to `LobbySpawn`.
   - `spectatorCameraEntity` to `SpectatorCamera` if you want its position/rotation included in the payload.
4. Set `safeZoneRadius` to match the Home Base area you want players to stand in before pressing **M**.
5. Leave `sendOnConnect=true` for normal playtests. The script waits for `ArcadeNetworkClient` to join the room, then sends:

   ```js
   room.send("manhunt:mapConfig", {
     safeZone: { x, y, z, radius },
     seekerStart: { x, y, z },
     hiderStarts: [{ x, y, z }, { x, y, z }, { x, y, z }],
     lobbySpawn: { x, y, z },
     spectatorCamera: { x, y, z, rotX, rotY, rotZ } // optional
   });
   ```

6. Press **O** during a playtest to resend/log the current marker config without restarting the server. Check the browser console and the server terminal for `[ManhuntMapConfig]` lines.
7. Restart the server and reload clients after uploading updated script files to PlayCanvas.

Production note: this client-sent bridge is intentionally convenient for development and classroom testing. A production server-authoritative game should load trusted map data on the server, or use a shared config file built into both client and server, instead of trusting arbitrary client coordinates.

### Entities to create or update

- `ManhuntSafeZone`
  - Add a visible flat cylinder/disc or transparent marker at the Home Base location if students need a visual target.
  - Assign this entity to both `ManhuntManager.safeZoneEntity` for local prompts and `ManhuntMapConfig.safeZoneEntity` for the server map-config bridge.
- `SpectatorCamera`
  - Create a camera entity named `SpectatorCamera` that looks at Home Base / SeekerStart.
  - Start it disabled in the Editor, then assign it to `ManhuntManager.spectatorCameraEntity`.
  - Assign the existing gameplay camera to `ManhuntManager.mainCameraEntity` so spectator mode can switch cameras cleanly for tagged/safe hiders and round-over results.
- Spawn transforms
  - Manhunt spawn positions are server-authoritative PlayCanvas world-space **player-root** coordinates during a round. With `ManhuntMapConfig.js`, the server receives those coordinates from assigned marker entities while the phase is `lobby`; if no config arrives, it falls back to the hardcoded defaults in `server/src/rooms/LobbyRoom.ts` and `server/src/schema/ManhuntState.ts`.
  - Create or update editor markers named `HiderSpawnA`, `HiderSpawnB`, `HiderSpawnC`, `SeekerSpawn`, and `LobbySpawn`, then assign them to `ManhuntMapConfig.js`.
  - If players fall through the floor after a server teleport, the spawn root is probably at or below the floor surface, or the marker is over scenery without a collision/static rigidbody. Move the marker to a walkable collision surface and resend with **O**.
- Player prefab/local player
  - Keep the root entity at scale `1,1,1` for gameplay/physics.
  - Put body visuals under a child named `AvatarVisual` or `Visual` so spectator mode can hide the local avatar without disabling the networking entity.
  - Put camera/head under a separate child so squash/stretch does not move or resize the collider.

### Current controls

- Gather at Home Base / the safe zone, then press **M** to request a server-authoritative Manhunt round.
- Pressing **M** outside Home Base shows "Go to Home Base to start Manhunt" locally, and the server also rejects invalid starts.
- Press **E** as a seeker during `activeRound` to ask the server to tag the nearest active hider within range. A seeker sees the shared centered `Press E to Tag` prompt only when they are active and close to an active hider; hiders and out-of-range seekers do not see it. `ManhuntManager.tagPromptDistance` defaults to `2.2` to mirror the server tag range, but the server still validates every tag request.
- Press **F** to toggle the Manhunt scoreboard overlay. It also opens automatically during `roundOver`.
- Press **P** while standing at an intended Manhunt marker to capture the local player root position. The client sends `debug:playerPositionCapture`, and the server logs `[ManhuntDebug] Position capture from ...: x, y, z`. This is still useful for debugging player-root Y values.
- Press **O** to resend/log `ManhuntMapConfig.js` marker positions while Manhunt is in the `lobby` phase.
- Use **WASD** to move in Free Roam / normal play.
- Move the **Mouse** to look while pointer lock is active.
- Hold **Shift** while moving to sprint; sprint uses stamina and recharges when not sprinting.
- Press **Space** to jump.

### After changing client scripts

- Re-upload any changed files from `client-scripts/` into PlayCanvas before running a classroom playtest.
- Re-check script attributes in the Editor after upload because newly added attributes may need assignments before Launch.

## Ticket Pickup Setup (Free Roam)
1. Create `TicketSpawnRoot` with **exactly 16 enabled child transforms** for ticket spawn candidates.
2. Create a disabled `TicketTemplate` entity to clone at runtime.
3. Attach `TicketPickupManager`, `FreeRoamStatusHud`, and optionally `TicketLeaderboard` to your NetworkManager/GameModeManager.
4. Wire `TicketPickupManager` attributes: network manager, local player, spawn root, template, collect radius, optional collect SFX asset.
5. Wire `FreeRoamStatusHud.networkManagerEntity` to the entity running `ArcadeNetworkClient.js`, leave `showDuringManhunt=false`, and keep the default `hudZIndex` unless another UI needs to layer above it.
6. Optional: add `TicketCollectibleVisual` on the ticket template for bob/rotation.
7. Launch the game and confirm the student-facing free-roam HUD shows a clean `Tickets` / `Players` display during normal play. It hides during onboarding/pregame UI, mini-game overlays, and non-lobby Manhunt phases unless `showDuringManhunt=true`.
8. Confirm the ticket debug overlay does **not** appear automatically. Press **2** to show it, then press **2** again to hide it (`F8` remains a backup toggle). Press **T** to log a ticket debug snapshot to the browser console and show/update an on-screen line; the overlay includes the nearest authoritative ticket, nearest visual clone, collection distances/tolerances, and recent request/success/rejection details.
