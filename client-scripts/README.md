# PlayCanvas Client Scripts (Upload to Editor)

These scripts are designed to be copied/uploaded into your **existing PlayCanvas Editor project** scene.

## Files

- `ArcadeConfig.js` - shared config (`SERVER_URL`, room name)
- `ArcadeNetworkClient.js` - Colyseus connection + room state events
- `LocalPlayerController.js` - local WASD movement + move sync to server
- `RemotePlayerManager.js` - creates/updates/removes remote placeholder avatars

## Important

1. Add the Colyseus JS client library to your PlayCanvas project.
2. Update `ArcadeConfig.js` with your Codespaces forwarded URL in `wss://...` format.
3. Attach scripts exactly as documented in `docs/PLAYCANVAS_SETUP.md`.

## TODO (future gameplay)

- Tickets system
- Shop economy
- Arcade machine interactions that launch mini-games
- Hide & Seek mode
