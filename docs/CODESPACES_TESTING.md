# GitHub Codespaces Multiplayer Testing

Use this to test same-room multiplayer with students quickly.

## Step-by-step

1. Open repo in **GitHub Codespaces**.
2. Start terminal.
3. Run:

```bash
cd server
npm install
npm run dev
```

4. Confirm server logs mention listening on port **2567**.
5. Open **PORTS** tab in Codespaces.
6. Locate port `2567`.
7. Set visibility to **Public** or **Organization** (school policy).
8. Copy forwarded URL.
9. Convert URL for WebSocket if needed:
   - `https://example-2567.app.github.dev`
   - becomes
   - `wss://example-2567.app.github.dev`
10. Paste into `ArcadeConfig.js` as `SERVER_URL`.
11. Launch PlayCanvas project in two tabs/devices.
12. Confirm both players appear and movement syncs.

## Validation checklist

- [ ] Both tabs connect without errors.
- [ ] Each tab can move with WASD.
- [ ] Each tab can see the other player's placeholder avatar.
- [ ] Disconnecting one tab removes that remote avatar from other tab.

## Important limitations for now

- Codespaces is development testing only.
- Not production scale or persistent world hosting.
- No auth/accounts yet.

## TODO (next iterations)

- Add room IDs/private class rooms.
- Add reconnection/timeout handling.
- Add role controls for classroom moderation.
