# Architecture

## High-Level Layers

1. **Game Shell (`src/game`)**
   - Bootstraps PlayCanvas app.
   - Owns lifecycle, scene wiring, and update loop.
2. **Scene Layer (`src/scenes`)**
   - Builds lobby geometry/entities.
3. **Entity Layer (`src/entities`)**
   - Reusable gameplay entities and interfaces.
4. **Mini-game Layer (`src/minigames`)**
   - Registry and mini-game modules.
5. **Network Layer (`src/network`)**
   - Swappable network client abstraction.
6. **UI Layer (`src/ui`)**
   - HUD and prompts independent from scene generation.

## Separation Rules

- Rendering/scene code should not directly embed transport-specific networking logic.
- Cabinets reference mini-game IDs; IDs resolve through registry.
- Keep future server implementation independent from static client hosting.

## Future Server Integration

A future `ColyseusNetworkClient` can replace `LocalMockNetworkClient` in one place (`createNetworkClient`).


## Practical Notes for Team Onboarding

- `LobbyScene` now reads cabinet spawn data from `src/scenes/lobbyLayout.ts`; keep this data-driven pattern for future portals/NPC spawns.
- `PlayerController` input handling uses named PlayCanvas key constants; continue this style to avoid magic-number drift.
- Keep mini-game loading behind the mini-game registry; avoid cabinet-side logic branching on game-specific behavior.
- If real-time state sync expands, introduce dedicated replicated state models (e.g., `src/network/state`) before wiring server payloads into scene entities.

## Known Risks (Pre-Multiplayer)

1. **Bundle growth risk**: importing many mini-games directly into the registry will increase initial load size.
2. **Scene coupling risk**: directly mutating entities from many systems can become hard to reason about.
3. **Input/state mixing risk**: local input and future remote snapshots should remain separated in controller/update flow.
