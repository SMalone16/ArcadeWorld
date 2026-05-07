# PlayCanvas Client Scripts (Upload to Editor)

These scripts are designed to be copied/uploaded into your **existing PlayCanvas Editor project** scene.

## Files

- `ArcadeConfig.js` - shared config (`SERVER_URL`, room name)
- `ArcadeNetworkClient.js` - Colyseus connection + room state events
- `LocalPlayerController.js` - local WASD movement + move sync to server
- `RemotePlayerManager.js` - creates/updates/removes remote avatars and DOM nametags
- `PlayerAppearance.js` - shared helper/script for body color and hat selection
- `PregameOverlay.js` - DOM pre-game profile picker for name, body color, and hat
- `NetworkDebugOverlay.js` - temporary DOM overlay for multiplayer playtests

## Important

1. Add the Colyseus JS client library to your PlayCanvas project.
2. Update `ArcadeConfig.js` with your Codespaces forwarded URL in `wss://...` format.
3. Attach scripts exactly as documented in `docs/PLAYCANVAS_SETUP.md`.
4. During multi-screen tests, add `NetworkDebugOverlay.js` to the same NetworkManager entity so each client reports its connection/session/remote-visibility state on screen.
5. For the pre-game flow, attach `PregameOverlay.js` to a `PregameUI` entity, set `PregameOverlay.networkClientEntity` to `NetworkManager`, and set `ArcadeNetworkClient.autoConnect=false`.

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

- Tickets system
- Shop economy
- Arcade machine interactions that launch mini-games
- Hide & Seek mode
