import http from "node:http";
import express, { type Request, type Response } from "express";
import cors from "cors";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { LobbyRoom } from "./rooms/LobbyRoom.js";

const PORT = Number(process.env.PORT ?? 2567);
const HOST = process.env.HOST ?? "0.0.0.0";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "arcade-world-server" });
});

const server = http.createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server })
});

gameServer.define("arcade_lobby", LobbyRoom);

server.listen(PORT, HOST, () => {
  console.log(`[ArcadeWorld] Colyseus listening on ws://${HOST}:${PORT}`);
  console.log("[ArcadeWorld] Room available: arcade_lobby");
});
