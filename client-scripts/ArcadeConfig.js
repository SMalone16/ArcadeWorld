/**
 * ArcadeConfig.js
 *
 * Single place to configure server connection for PlayCanvas scripts.
 *
 * For local development:
 *   ws://localhost:2567
 *
 * For GitHub Codespaces testing:
 *   1) Run server in Codespaces on port 2567.
 *   2) Copy forwarded URL from PORTS tab.
 *   3) Convert https://... to wss://...
 *   4) Paste below as SERVER_URL.
 */
window.ArcadeConfig = {
  SERVER_URL: "ws://localhost:2567",
  ROOM_NAME: "arcade_lobby",
  PLAYER_NAME_PREFIX: "Student"
};
