# Arcade World Architecture (Current Slice)

## High-level split

- **`src/scenes`** owns static, visual scene assembly (room, lights, cabinets, camera roots).
- **`src/network`** owns multiplayer lifecycle concerns (join/leave, player spawn/despawn mappings).
- **`src/events`** owns lobby-wide event rules such as Manhunt rounds, scoring, safe-zone checks, and tag input.
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
- `network/LocalMockNetworkClient.ts`: join flow picks free spawn transforms (random from free points), applies consistent initial rotation, falls back to farthest/round-robin when saturated, stores `clientId -> Entity`, exposes current player ids for event systems, and despawns on leave/disconnect.
- `entities/PlayerController.ts`: local input, sprint/jump movement feel, camera look, and visual-only squash/stretch on the `AvatarVisual` child.
- `game/ArcadeGame.ts`: orchestration only; requests joins, reads local player entity from the network layer, wires HUD updates, forwards Manhunt start/reset input, and sends local-authoritative transform snapshots at a fixed rate with threshold guardrails.
- `events/ManhuntRoundManager.ts`: central Manhunt vertical slice with `lobby -> countdown -> hidingPhase -> seekingPhase -> roundOver`, one seeker assignment, hider safe scoring, seeker tag scoring, survivor/failed-hider end scoring, debug logs, and lobby resets.
- `ui/ManhuntHud.ts`: simple DOM HUD for round state, team, timer, hider counts, controls, and results.

## Why this helps students

- Each module has one clear purpose.
- Networking and rendering responsibilities remain easy to trace.
- Replacing mock networking with Colyseus remains isolated in `src/network`.

## Explicit non-goals for this slice

- Full ticket economy
- Shop/cosmetic purchasing
- Arcade cabinet mini-game launch integration
- Advanced hiding props or map-specific hiding-place logic

## Future expansion TODO

- Move server to dedicated production hosting.
- Add authentication and moderation.
- Add anti-cheat validation.
- Add mini-game room transitions.
