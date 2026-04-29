# Arcade World Architecture (Current Slice)

## High-level split

- **`src/scenes`** owns static, visual scene assembly (room, lights, cabinets, camera roots).
- **`src/network`** owns multiplayer lifecycle concerns (join/leave, player spawn/despawn mappings).
- **`server/`** owns authoritative room state and connected client presence.

This separation keeps networking logic out of render-only scene scripts.

## Server responsibilities (`/server`)

- Host room `arcade_lobby`
- Track connected players in room state
- Accept movement updates (`move` message)
- Sync x/y/z (+ yaw) to all clients
- Remove players on disconnect

## Client responsibilities (`/src`)

- `scenes/LobbyScene.ts`: build static lobby + provide `playersRoot` and `SpawnPoint` transforms for network joins.
- `entities/PlayerPrefab.ts`: reusable player entity factory used for local and remote players.
- `network/LocalMockNetworkClient.ts`: join flow picks free spawn transforms (random from free points), applies consistent initial rotation, falls back to farthest/round-robin when saturated, stores `clientId -> Entity`, and despawns on leave/disconnect.
- `entities/PlayerController.ts`: local input and camera follow for the local player's entity.
- `game/ArcadeGame.ts`: orchestration only; requests joins and reads local player entity from the network layer.

## Why this helps students

- Each module has one clear purpose.
- Networking and rendering responsibilities remain easy to trace.
- Replacing mock networking with Colyseus remains isolated in `src/network`.

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
