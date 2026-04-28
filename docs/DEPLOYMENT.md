# Deployment

## Client Hosting

The client is static and should be deployed via GitHub Pages (or equivalent static host).

### Why GitHub Pages is client-only

GitHub Pages only serves static content. It cannot run persistent Node.js processes or WebSocket servers required for real-time multiplayer.

## Multiplayer Server Hosting

Run the future Node.js server separately on a platform that supports long-running services and WebSockets.

Recommended options:
- Render
- Railway
- Fly.io
- AWS (EC2/ECS/Lambda+API Gateway WebSockets where suitable)
- GCP / Azure equivalents

## Codespaces Clarification

GitHub Codespaces is excellent for development/testing but is not production hosting. Treat Codespaces instances as temporary environments.

## Expected Split

- `arcade-world-client` (this repo): static PlayCanvas app.
- `arcade-world-server` (future): authoritative multiplayer backend (likely Colyseus).
