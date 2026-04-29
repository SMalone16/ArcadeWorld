# Multiplayer Smoke Test Report — 2026-04-29

## Scope

Requested validation:
1. Two browser instances connect to the same room/session.
2. Each user sees self as local-owned cube and other users as remote cubes.
3. Each user has independent first-person camera control.
4. Late join, disconnect, reconnect spawn/despawn correctness.
5. No duplicate local input control on remote proxies.
6. Record known issues and target fixes.

## Environment Used

- Date: 2026-04-29 (UTC)
- Repo: `ArcadeWorld`
- Client runtime: Vite + PlayCanvas
- Server runtime: Colyseus room in `server/`

## Result Summary

## 1) Two browser instances connect to same room/session

**Status: BLOCKED (not currently implementable in this branch).**

Reason:
- Client networking currently binds to `LocalMockNetworkClient` via `createNetworkClient()` and does not create a Colyseus websocket room connection.
- The local mock spawns one synthetic remote proxy (`mock-client-2`) rather than synchronizing real peers.

## 2) Local-owned cube vs remote cubes

**Status: PARTIALLY VERIFIED (single-process mock only).**

What is verified in code:
- The mock local player is spawned with `isOwner: true`.
- The synthetic remote proxy is spawned with `isOwner: false`.
- `PlayerPrefab` enables the camera for owner only and disables non-owner camera components.

What is not yet verified end-to-end:
- Real multi-user ownership assignment across independent browser sessions.

## 3) Independent first-person camera control per user

**Status: BLOCKED end-to-end / PARTIALLY VERIFIED by architecture.**

What is verified in code:
- The game creates a single `PlayerController` bound to the local client entity ID (`local-client-1`).
- Non-owner players do not have active cameras.

What is not verified yet:
- Independent control in two real connected sessions.

## 4) Late join, disconnect, reconnect spawn/despawn correctness

**Status: BLOCKED end-to-end / PARTIALLY VERIFIED by server and mock lifecycle methods.**

What is verified in code:
- Server room adds players on join and removes on leave.
- Mock client supports despawn-on-leave and disconnect cleanup.

What is not verified yet:
- Real client reconnect path and late-join consistency against live room state.

## 5) No duplicate local input control on remote proxies

**Status: PARTIALLY VERIFIED (single-process mock only).**

What is verified in code:
- Local input flow (`sendInput`) is applied from local entity state and forwarded as snapshots to remote proxy buffers.
- Only one `PlayerController` instance is created for local entity in `ArcadeGame`.

Potential risk remaining:
- Real network client may still need explicit guardrails to prevent ownership/control mixups if not encoded in authoritative messages.

## Known Issues (Current)

1. **No real browser-to-browser networking path in client yet.**
   - Impact: Cannot execute true two-user room tests.
   - Target fix: Add a Colyseus-backed `NetworkClient` implementation in `src/network/` and select it via configuration/environment.

2. **Local client ID is hardcoded (`local-client-1`).**
   - Impact: Ownership and identity assumptions do not represent real multi-client sessions.
   - Target fix: Use server-assigned session IDs and map ownership from room join response.

3. **No explicit reconnect/rehydration flow in client.**
   - Impact: Late-join/reconnect behavior remains unvalidated for production path.
   - Target fix: Add reconnect strategy and resubscribe to room state/add-remove events.

4. **Testing checklist exists but no automated multiplayer smoke harness.**
   - Impact: Regressions likely during networking integration.
   - Target fix: Add a repeatable test script/checklist runbook and (optionally) Playwright multi-context smoke test.

## Target Fixes Before Larger Test

1. Implement `ColyseusNetworkClient` (real ws/wss join + state listeners + add/remove entity mapping).
2. Feature-flag network backend (`mock` vs `colyseus`) through config.
3. Drive local ownership from session ID returned by server.
4. Add join/leave/reconnect telemetry logs and assertions.
5. Re-run this smoke matrix with two real browser contexts (or two devices) and record pass/fail with timestamps.

## Commands Executed for This Validation

```bash
npm run build
npm --prefix server run build
```
