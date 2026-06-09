# PlayCanvas Client Scripts (Upload to Editor)

These scripts are designed to be copied/uploaded into your **existing PlayCanvas Editor project** scene.

## Files

- `ArcadeConfig.js` - shared config (`SERVER_URL`, room name)
- `ArcadeNetworkClient.js` - Colyseus connection + room state events
- `LocalPlayerController.js` - local WASD movement, Shift sprint/stamina, and move sync to server
- `RemotePlayerManager.js` - creates/updates/removes remote avatars and DOM nametags
- `PlayerAppearance.js` - shared helper/script for body color and hat selection
- `PregameOverlay.js` - DOM pre-game profile picker for name, body color, and hat
- `NetworkDebugOverlay.js` - temporary DOM overlay for multiplayer playtests
- `InteractionPrompt.js` - reusable centered DOM prompt for contextual **E** actions such as arcade cabinets and Manhunt tags
- `TicketSnakeGame.js` - vanilla DOM/canvas Ticket Snake overlay mini-game; no PlayCanvas scene switch or extra assets
- `ArcadeCabinetGameLauncher.js` - distance-based arcade cabinet launcher that opens Ticket Snake and sends ticket awards through the network client
- `ManhuntManager.js` - PlayCanvas Manhunt UI/controller for the server-authoritative round state, tagging requests, centered tag prompts, safe-zone prompts, action feed feedback, spectator view, tag burst FX, and DOM HUD
- `ManhuntMapConfig.js` - sends PlayCanvas marker positions to the server during the lobby phase for classroom/dev map setup
- `TicketPickupManager.js` - clones ticket visuals, requests server-validated collection, and renders ticket debug information
- `TicketLeaderboard.js` - shows the current room ticket standings
- `TicketCollectibleVisual.js` - optional bob/rotation visual behavior for ticket templates

## Free Roam controls

- **WASD** to move.
- **Mouse** to look.
- Near a wired arcade cabinet, press **E** to open Ticket Snake.
- Hold **Shift** while moving to sprint.
- Sprint uses stamina and recharges when not sprinting.

## Important

1. Add the Colyseus JS client library to your PlayCanvas project.
2. Update `ArcadeConfig.js` with your Codespaces forwarded URL in `wss://...` format.
3. Attach scripts exactly as documented in `docs/PLAYCANVAS_SETUP.md`.
4. During multi-screen tests, add `NetworkDebugOverlay.js` to the same NetworkManager entity so each client reports its connection/session/remote-visibility state on screen.
5. For the pre-game flow, attach `PregameOverlay.js` to a `PregameUI` entity, set `PregameOverlay.networkClientEntity` to `NetworkManager`, and set `ArcadeNetworkClient.autoConnect=false`.
6. For centered prompts, attach `InteractionPrompt.js` once to `GameModeManager`, `NetworkManager`, or another always-enabled entity.
7. For a cabinet mini-game, upload `TicketSnakeGame.js` and `ArcadeCabinetGameLauncher.js`, then attach `ArcadeCabinetGameLauncher.js` to a cabinet entity (or manager) and assign `networkManagerEntity`, `localPlayerEntity`, and optionally `cabinetEntity`.
8. For Manhunt tests, attach `ManhuntManager.js` to `GameModeManager` or `NetworkManager`, then assign its network manager, remote player manager, local player, camera, spectator camera, tag SFX, and safe-zone attributes as needed. Press `M` in the lobby to start/reset; seekers see `Press E to Tag` only beside an active hider during `activeRound`, then **E** sends the existing server-authoritative tag request. `tagPromptDistance` defaults to `2.2`.
9. Optional tag sound setup: assign `ManhuntManager.tagSfxEntity` to an entity that has a **Sound** component and a sound slot named `tagPop`. If this entity/slot is not assigned, tag SFX is skipped safely.
10. The Manhunt action feed (bottom-left, last 5 important actions) requires no separate setup and appears automatically during rounds.

## Pre-game customization setup

- `PregameOverlay.js` shows a simple DOM panel before joining the Colyseus room. Students can enter a display name, choose a safe hex body color, and select exactly `No Hat`, `Top Hat`, or `Western`. While it is open, the app is in `onboarding`: the cursor stays visible, pointer lock is released, and gameplay mouse/keyboard input is ignored.
- `ArcadeNetworkClient.autoConnect` defaults to `true` for backward compatibility. Leave it enabled for the old instant-join flow; disable it when using the pre-game overlay so **Play** is the only action that switches to `playing`, requests pointer lock, and sends the selected profile.
- Add `PlayerAppearance.js` to local and remote visual entities when possible. `RemotePlayerManager` also calls the shared `window.ArcadePlayerAppearance.applyToEntity` helper if the script is not attached.
- Recommended visual hierarchy for both `RemotePlayerTemplate` and any visible local-player model:

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

- `No Hat` may be an actual child under `Hats`; it should be enabled by default. `Top Hat` and `Western` can start disabled because code toggles them.
- Remote nametags are DOM-based and do not require the existing `NameTag` child to contain working 3D text.

## Arcade Cabinet Mini-Game: Ticket Snake

- Required scripts: `InteractionPrompt.js`, `TicketSnakeGame.js`, `ArcadeCabinetGameLauncher.js`, and the existing `ArcadeNetworkClient.js`.
- Attach `InteractionPrompt.js` once to an always-enabled scene entity so all systems share the same centered prompt style.
- Attach `ArcadeCabinetGameLauncher.js` to the arcade cabinet entity, or to a manager entity with `cabinetEntity` assigned to the cabinet transform.
- Set `networkManagerEntity` to the entity running `ArcadeNetworkClient.js`, `localPlayerEntity` to `LocalPlayer`, and leave `interactionRadius` near `2.5` unless your cabinet/player scale needs tuning.
- When the local player is close enough, the centered prompt shows `Press E to Play`. The prompt is hidden during onboarding/pregame UI and while Ticket Snake is open.
- Pressing **E** opens Ticket Snake as a DOM/canvas overlay over the existing PlayCanvas scene. It releases pointer lock, pauses local movement input, keeps the network connection alive, and returns to the same scene when closed.
- Ticket Snake controls: **Space** starts from the title screen, **WASD** or **Arrow Keys** steer, wall/self collision ends the game, and **E** returns after game over.
- Ticket rewards are shown locally using score bands: 0 = 1 ticket, 1–2 = 2, 3–4 = 4, 5–7 = 6, 8–11 = 8, 12+ = 10. The server still clamps the requested award to an integer from 1–10 before adding it to `player.tickets`, so the leaderboard/local ticket display updates through the existing ticket state callbacks.

## TODO (future gameplay)

- Shop economy and account-backed persistence
- More arcade machine mini-games and a cabinet/game registry
- Production trusted map config for Manhunt/Hide & Seek

## Ticket Economy (Prototype)
- Add `TicketPickupManager` and `TicketLeaderboard` scripts to your NetworkManager or GameModeManager entity.
- Create `TicketSpawnRoot` with exactly 16 enabled child transform markers.
- Create a disabled `TicketTemplate` entity (with visuals/collider and optional `TicketCollectibleVisual`).
- Assign `networkManagerEntity`, `localPlayerEntity`, `ticketSpawnRoot`, `ticketTemplate`, `collectRadius` and optional `collectSfx`.
- Ticket totals are prototype-persisted via `localStorage` per browser/device.
- Ticket debug controls: press `2` to toggle the in-game ticket debug overlay (`F8` remains available as a backup toggle). Press `T` to log a ticket debug snapshot to the browser console and show an on-screen confirmation/overlay with nearest authoritative ticket, nearest visual clone, and recent collection request/rejection details.
