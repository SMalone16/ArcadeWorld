# PlayCanvas Setup Guide (Teacher Steps)

This assumes your PlayCanvas Editor project and map scene already exist.

## 1) Add script files to PlayCanvas assets

Upload/copy these files from repo folder `client-scripts/`:
- `ArcadeConfig.js`
- `ArcadeNetworkClient.js`
- `LocalPlayerController.js`
- `RemotePlayerManager.js`

## 2) Add Colyseus client library in PlayCanvas

Choose one option:

- **Option A (recommended):** Add external script URL for Colyseus browser client.
- **Option B:** Upload a bundled Colyseus browser build file into assets.

The global `Colyseus` object must be available before `ArcadeNetworkClient.js` runs.

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
2. Attach `LocalPlayerController.js` script.
3. In script attributes:
   - assign `networkManagerEntity` to the entity created in step B.
   - adjust `moveSpeed` if needed.

### B) Network manager entity

1. Create an empty entity (example: `NetworkManager`).
2. Attach `ArcadeNetworkClient.js` script.
3. Attach `RemotePlayerManager.js` script.
4. In `ArcadeNetworkClient` attributes:
   - set `serverUrl` (or keep empty and provide `window.ArcadeConfig.SERVER_URL`).
   - set `roomName` (or keep empty and provide `window.ArcadeConfig.ROOM_NAME`).
   - assign `playerTemplate` to your player prefab/template entity (**required**).
   - optionally assign `remotePlayerManagerEntity` and `localPlayerEntity` for easier runtime diagnostics.
4. In `RemotePlayerManager` attributes:
   - set `networkClientEntity` to this same `NetworkManager` entity.

## 5) Launch and verify

1. Press **Launch** in PlayCanvas.
2. Open a second tab/device with same launch URL.
3. Move local player with WASD.
4. Verify remote placeholder avatar appears and updates.

## Troubleshooting

- If no connection: verify `SERVER_URL` is `wss://` and Codespaces port 2567 is visible.
- If scripts fail: verify Colyseus client script loaded first.
- If local player does not move: confirm keyboard focus is on the game iframe/tab.
- If you see `[ArcadeNetworkClient] Connection failed` with `Cannot read properties of undefined (reading 'onAdd')`: this means `room.state.players` is missing on the client. Re-upload the latest `ArcadeNetworkClient.js` (which guards before binding listeners) and confirm your server room calls `this.setState(new ArcadeWorldState())` and initializes `players` as a `MapSchema`.

## TODO (future)

- Replace placeholder avatars with student-customizable characters.
- Add cabinet interactions, tickets, and shop logic.
