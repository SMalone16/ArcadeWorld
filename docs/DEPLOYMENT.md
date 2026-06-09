# Deployment

## Current split

Arcade World has a static client and a separate real-time multiplayer server:

- **Static client:** the Vite/TypeScript app in `src/` builds with `npm run build` and outputs static files in `dist/`.
- **PlayCanvas Editor client:** scripts in `client-scripts/` are uploaded to PlayCanvas Editor and run in the launched PlayCanvas project.
- **Multiplayer server:** `server/` is a Node/TypeScript Colyseus process that must run on infrastructure that supports long-lived WebSocket connections.

## Client hosting

The static Vite client can be deployed to GitHub Pages or any static host.

GitHub Pages can also host static support assets/documentation, but it **cannot** run the Colyseus server because Pages does not provide persistent Node.js processes or WebSocket server hosting.

## Multiplayer server hosting

For production-like playtests, deploy `server/` separately on a WebSocket-capable host.

Reasonable options include:

- Render
- Railway
- Fly.io
- AWS EC2/ECS or other long-running Node hosting
- GCP/Azure equivalents

The server currently exposes:

- `GET /health` for a basic health check.
- Colyseus room `arcade_lobby` over WebSockets.
- Default local port `2567` unless `PORT` is set.

## Codespaces clarification

GitHub Codespaces is excellent for development and temporary classroom testing. Treat Codespaces URLs as temporary; they are not durable production server endpoints.

## Expected production shape

- Static client assets hosted on GitHub Pages or a similar CDN/static host.
- Colyseus server hosted separately with a stable HTTPS/WSS endpoint.
- PlayCanvas `ArcadeConfig.js` or equivalent environment config pointed at that stable `wss://` server URL.
