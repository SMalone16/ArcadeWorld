# Roadmap

## Current slice

- Static Vite/TypeScript lobby scaffold with PlayCanvas rendering.
- Modular entities, scene assembly, interaction prompts, mini-game registry, HUD, and local mock networking.
- PlayCanvas Editor scripts for real Colyseus classroom playtests.
- Shared lobby presence with profile selection, synchronized movement, remote interpolation, nametags, and appearance.
- Server-authoritative Manhunt vertical slice with Home Base start validation, team assignment, server teleports, tagging, safe-zone scoring, spectator/scoreboard UI, and marker-config bridge for playtests.
- Prototype ticket pickups with server validation, respawn, localStorage-backed device ticket totals, leaderboard, and debug overlay.

## Next: stabilize playtests

- Re-run and document a fresh two-device/two-tab multiplayer smoke test covering join, profile sync, movement, late join, disconnect, Manhunt, and tickets.
- Add clearer teacher-facing checklists for setup validation and common failure states.
- Add room IDs/private class rooms for safer classroom sessions.
- Improve reconnect/rehydration after tab refresh or brief network loss.
- Keep reducing PlayCanvas Editor setup friction.

## Next: production readiness

- Move multiplayer hosting to a proper WebSocket-capable deployment target.
- Replace client-sent Manhunt map config with trusted server-loaded/shared map config.
- Add authentication or classroom session identity, basic moderation controls, and abuse-safe naming/profile validation.
- Add automated checks for server message/schema compatibility.

## Later gameplay expansion

- Cabinet-to-mini-game launch flow.
- More mini-games owned by separate student teams.
- Shop/cosmetic purchasing using tickets.
- Persistent progression beyond browser-local ticket totals.
- Art/audio polish pass for the lobby.
