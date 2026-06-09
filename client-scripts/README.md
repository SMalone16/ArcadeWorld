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
- `ManhuntManager.js` - PlayCanvas Manhunt UI/controller for the server-authoritative round state, tagging requests, safe-zone prompts, action feed feedback, spectator view, tag burst FX, and DOM HUD
- `ManhuntMapConfig.js` - sends PlayCanvas marker positions to the server during the lobby phase for classroom/dev map setup
- `TicketPickupManager.js` - clones ticket visuals, requests server-validated collection, and renders ticket debug information
- `TicketLeaderboard.js` - shows the current room ticket standings
- `TicketCollectibleVisual.js` - optional bob/rotation visual behavior for ticket templates

## Free Roam controls

- **WASD** to move.
- **Mouse** to look.
- Hold **Shift** while moving to sprint.
- Sprint uses stamina and recharges when not sprinting.

## Important

1. Add the Colyseus JS client library to your PlayCanvas project.
2. Update `ArcadeConfig.js` with your Codespaces forwarded URL in `wss://...` format.
3. Attach scripts exactly as documented in `docs/PLAYCANVAS_SETUP.md`.
4. During multi-screen tests, add `NetworkDebugOverlay.js` to the same NetworkManager entity so each client reports its connection/session/remote-visibility state on screen.
5. For the pre-game flow, attach `PregameOverlay.js` to a `PregameUI` entity, set `PregameOverlay.networkClientEntity` to `NetworkManager`, and set `ArcadeNetworkClient.autoConnect=false`.
6. For Manhunt tests, attach `ManhuntManager.js` to `GameModeManager` or `NetworkManager`, then assign its network manager, remote player manager, local player, camera, spectator camera, tag SFX, and safe-zone attributes as needed. Press `M` in the lobby to start/reset and press `E` as the seeker to tag nearby active hiders.
7. Optional tag sound setup: assign `ManhuntManager.tagSfxEntity` to an entity that has a **Sound** component and a sound slot named `tagPop`. If this entity/slot is not assigned, tag SFX is skipped safely.
8. The Manhunt action feed (bottom-left, last 5 important actions) requires no separate setup and appears automatically during rounds.

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

## TODO (future gameplay)

- Shop economy and account-backed persistence
- Arcade machine interactions that launch mini-games
- Production trusted map config for Manhunt/Hide & Seek

## Ticket Economy (Prototype)
- Add `TicketPickupManager` and `TicketLeaderboard` scripts to your NetworkManager or GameModeManager entity.
- Create `TicketSpawnRoot` with exactly 16 enabled child transform markers.
- Create a disabled `TicketTemplate` entity (with visuals/collider and optional `TicketCollectibleVisual`).
- Assign `networkManagerEntity`, `localPlayerEntity`, `ticketSpawnRoot`, `ticketTemplate`, `collectRadius` and optional `collectSfx`.
- Ticket totals are prototype-persisted via `localStorage` per browser/device.
- Ticket debug controls: press `2` to toggle the in-game ticket debug overlay (`F8` remains available as a backup toggle). Press `T` to log a ticket debug snapshot to the browser console and show an on-screen confirmation/overlay with nearest authoritative ticket, nearest visual clone, and recent collection request/rejection details.
