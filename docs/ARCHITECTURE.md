# Arcade World Architecture (Current State)

Arcade World currently has three major areas:

1. **Static prototype client (`src/`)** - TypeScript + Vite + PlayCanvas code that can be hosted as static files and uses a local mock network adapter.
2. **PlayCanvas Editor scripts (`client-scripts/`)** - JavaScript scripts copied into a PlayCanvas Editor project for classroom multiplayer playtests.
3. **Colyseus server (`server/`)** - Node/TypeScript room server that owns shared multiplayer state for the PlayCanvas Editor playtest path.

The split is intentional: the static client remains GitHub-Pages-friendly, while real-time multiplayer runs in a separate long-lived server process.

## Runtime paths

### Static Vite prototype (`src/`)

- `main.ts` creates a PlayCanvas canvas and starts `ArcadeGame`.
- `game/ArcadeGame.ts` orchestrates the app: scene creation, mock network join, local player controller, HUD, cabinet prompts, and local Manhunt input.
- `scenes/LobbyScene.ts` builds a simple lobby, arcade cabinets, spawn points, lights, walls/floor, and a visible Manhunt safe-zone marker.
- `network/LocalMockNetworkClient.ts` provides the local-only network abstraction. It spawns a local player and a synthetic remote proxy, exposes player IDs/entities, and feeds transform snapshots for interpolation testing.
- `events/ManhuntRoundManager.ts` runs the TypeScript local Manhunt prototype. This is useful for static-client architecture work, but it is not the authoritative multiplayer Manhunt used by the PlayCanvas classroom path.
- `minigames/registry.ts` keeps mini-game lookup modular. The default registered mini-game is still an example placeholder.

### PlayCanvas Editor client (`client-scripts/`)

These files are plain JavaScript because they are uploaded to PlayCanvas Editor assets:

- `ArcadeNetworkClient.js` connects to Colyseus, joins `arcade_lobby`, sends movement/profile/ticket/Manhunt messages, tracks room state, applies explicit server teleports, and exposes callbacks/getters for other scripts.
- `LocalPlayerController.js` handles first-person local movement, sprint, jump, pointer lock, and input lockouts while onboarding or during Manhunt-controlled phases/statuses.
- `RemotePlayerManager.js` creates/removes/interpolates remote avatars, applies appearance, projects DOM nametags, and hides nameplates according to Manhunt visibility rules.
- `PregameOverlay.js` owns the pre-game profile picker for name, body color, and hat.
- `PlayerAppearance.js` centralizes avatar tint/hat application so local and remote visuals use the same rules.
- `ManhuntManager.js` renders Manhunt HUD layers, sends start/tag/debug requests, handles spectator/camera behavior, and plays optional tag feedback.
- `ManhuntMapConfig.js` sends PlayCanvas marker positions to the server while in the lobby phase. This is a development/classroom bridge, not production-trusted map loading.
- `TicketPickupManager.js`, `TicketLeaderboard.js`, and `TicketCollectibleVisual.js` implement the free-roam ticket pickup prototype UI/visuals around server-owned ticket state.
- `DebugUiToggle.js` owns one shared `window.ArcadeDebugUi` state so developer overlays stay hidden by default and toggle together with `2`/backup `F8`.
- `NetworkDebugOverlay.js` renders connection/session/remote-visibility diagnostics for playtests only when shared debug UI is visible.

## Server responsibilities (`server/`)

- Start an HTTP/Colyseus process on `PORT` (default `2567`) and expose `/health`.
- Define the shared room `arcade_lobby`.
- Track `players`, `manhunt`, and `tickets` in Colyseus schema state.
- Accept player profile updates (`profile`) for display name, color, hat, saved ticket count, and device ID.
- Accept movement updates (`move`) and sync x/y/z/rotation to other clients when the player is allowed to move.
- Run server-authoritative Manhunt state:
  - phases: `lobby`, `teamReveal`, `spawnCountdown`, `activeRound`, `roundOver`.
  - 5-second team reveal, 5-second spawn countdown, 60-second active round, and 30-second round-over display.
  - balanced seeker/hider assignment, movement locks, explicit server teleports, safe-zone scoring, tag scoring, survivor points, and reset to lobby.
- Accept development Manhunt map config (`manhunt:mapConfig`) only while in the lobby phase.
- Run server-owned ticket pickup validation:
  - exactly 16 configured spawn positions.
  - 10 active tickets initially.
  - 2.5-unit XZ collection distance and 3-unit vertical tolerance.
  - collected tickets are removed and respawned with fresh IDs after 5-10 seconds.
- Remove players on disconnect and end/reset round state as needed.

## Important boundaries

- Rendering/scene setup should not own networking rules.
- Networking code should expose state and events to UI/gameplay systems instead of directly embedding render behavior.
- Cabinet entity definitions should not hardcode mini-game-specific behavior; use the mini-game registry and interaction abstractions.
- Production multiplayer must not trust arbitrary client-sent map coordinates. The current Manhunt marker bridge exists to speed up classroom playtests.

## Current non-goals

- Production-scale hosting.
- Authentication/accounts and classroom moderation.
- Shop/cosmetic purchasing.
- Persistent cloud progression.
- Fully automated multiplayer browser smoke tests.
