# AGENTS.md - Arcade World

These instructions apply to the entire repository.

## Core Coding Rules

1. Use **TypeScript** for all gameplay/client logic.
2. Keep systems modular and easy for students to follow.
3. Do **not** mix networking logic directly into rendering/scene logic.
4. Do **not** hardcode mini-game behavior directly inside cabinet entity definitions.
5. Preserve compatibility with static hosting (GitHub Pages) for the client.
6. Multiplayer server code should eventually live separately (`/server` or separate repo).
7. Run project scripts before finalizing (`npm run build` at minimum).
8. Update docs in `docs/` whenever architecture or deployment guidance changes.

## Project Intent

- Cozy, school-friendly, browser-based virtual arcade.
- 2.5D lobby-first structure.
- Prioritize readability over clever abstractions.

## Change Management

- Keep files focused and small.
- Leave explanatory comments when introducing non-obvious architecture decisions.
- Prefer extending existing abstractions (`ArcadeGame`, `LobbyScene`, `NetworkClient`, mini-game registry) rather than bypassing them.
