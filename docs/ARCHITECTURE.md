# Arcade World Architecture (Current Slice)

## High-level split

- **PlayCanvas Editor project:** owns visual scene/map/lights/layout.
- **Repo `/client-scripts`:** reusable runtime logic scripts attached in PlayCanvas.
- **Repo `/server`:** Colyseus authoritative room state server.

This separation keeps networking logic out of scene-authoring concerns.

## Server responsibilities (`/server`)

- Host room `arcade_lobby`
- Track connected players in room state
- Accept movement updates (`move` message)
- Sync x/y/z (+ yaw) to all clients
- Remove players on disconnect

## Client script responsibilities (`/client-scripts`)

- `ArcadeConfig.js`: endpoint and room configuration
- `ArcadeNetworkClient.js`: connect/join + state event fan-out
- `LocalPlayerController.js`: read WASD input and send movement
- `RemotePlayerManager.js`: create/update/remove placeholder remote avatars

## Why this helps students

- Each script has one clear purpose.
- Easy to reason about and debug.
- Easy to replace placeholder parts later.

## Explicit non-goals for this slice

- Ticket economy
- Shop mechanics
- Arcade cabinet mini-game launch integration
- Hide & Seek rules

## Future expansion TODO

- Move server to dedicated production hosting.
- Add authentication and moderation.
- Add interpolation/smoothing and anti-cheat validation.
- Add mini-game room transitions.
