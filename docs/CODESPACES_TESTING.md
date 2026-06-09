# GitHub Codespaces Multiplayer Testing

Use this guide for temporary same-room multiplayer playtests with the PlayCanvas Editor client scripts.

## Step-by-step

1. Open the repo in **GitHub Codespaces**.
2. Start a terminal.
3. Run the server:

```bash
cd server
npm install
npm run dev
```

4. Confirm server logs mention Colyseus listening on port **2567** and room `arcade_lobby`.
5. Open the **PORTS** tab in Codespaces.
6. Locate port `2567`.
7. Set visibility to **Public** or **Organization** according to school policy.
8. Copy the forwarded URL.
9. Convert the URL for WebSocket use if needed:
   - `https://example-2567.app.github.dev`
   - becomes
   - `wss://example-2567.app.github.dev`
10. Paste the `wss://...` value into `client-scripts/ArcadeConfig.js` as `SERVER_URL` and re-upload that script to PlayCanvas if needed.
11. Launch the PlayCanvas project in two tabs/devices.
12. Choose different pre-game profiles and click **Play** on each client.

## Validation checklist

### Connection and movement

- [ ] Both clients show `Connected: yes` in `NetworkDebugOverlay`.
- [ ] Each client has a unique `Session ID`.
- [ ] Both clients show the same room name, `arcade_lobby`.
- [ ] Each client can move with WASD, look with mouse, sprint with Shift, and jump with Space.
- [ ] Each client can see the other player's avatar moving.
- [ ] Remote nametags and profile appearance match the other client's selected name/color/hat.
- [ ] Disconnecting one tab removes that remote avatar from the other tab.

### Manhunt

- [ ] At least two players gather at Home Base / the safe zone.
- [ ] Pressing **M** outside Home Base shows a rejection message.
- [ ] Pressing **M** at Home Base starts server-authoritative Manhunt.
- [ ] Team reveal, spawn countdown, active round, and round-over UI appear.
- [ ] Seekers can tag active hiders with **E** when close enough.
- [ ] Hiders become safe when they reach Home Base during the active round.
- [ ] The scoreboard opens during round-over and players return to lobby/free roam afterward.

### Tickets, when ticket setup is enabled

- [ ] `TicketSpawnRoot` has exactly 16 enabled child markers.
- [ ] The server accepts the spawn config and seeds 10 active tickets.
- [ ] Walking into a ticket sends a collect request and increases the player's ticket total.
- [ ] Ticket leaderboard updates across clients.
- [ ] Pressing **2** toggles the ticket debug overlay; **F8** remains a backup toggle.
- [ ] Pressing **T** logs a ticket debug snapshot in the browser console.

## Important limitations

- Codespaces is development/testing only.
- Codespaces URLs are temporary and may change when the environment restarts.
- No production auth/accounts or moderation yet.
- No private classroom room IDs yet; the current room name is shared.
- The current Manhunt map-config bridge trusts a client during setup and should be replaced before production use.

## TODO (next iterations)

- Add room IDs/private class rooms.
- Add reconnection/timeout handling.
- Add role controls for classroom moderation.
- Add a repeatable automated or semi-automated multiplayer smoke harness.
