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
