import { Client, Room } from "@colyseus/core";
import { ArcadeWorldState } from "../schema/ArcadeWorldState.js";
import { PlayerState } from "../schema/PlayerState.js";

type MovementMessage = {
  x: number;
  y: number;
  z: number;
  rotY?: number;
  yaw?: number;
  name?: string;
};

/**
 * Single shared room for today's vertical slice.
 * Room name: arcade_lobby
 */
export class LobbyRoom extends Room<ArcadeWorldState> {
  maxClients = 64;

  onCreate(): void {
    this.setState(new ArcadeWorldState());

    this.onMessage("move", (client, message: MovementMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        return;
      }

      // Basic numeric safety guard to avoid NaN / invalid packets.
      if (
        !Number.isFinite(message.x) ||
        !Number.isFinite(message.y) ||
        !Number.isFinite(message.z)
      ) {
        return;
      }

      player.x = message.x;
      player.y = message.y;
      player.z = message.z;

      const rotY =
        typeof message.rotY === "number"
          ? message.rotY
          : typeof message.yaw === "number"
            ? message.yaw
            : undefined;

      if (typeof rotY === "number" && Number.isFinite(rotY)) {
        player.rotY = rotY;
      }

      if (typeof message.name === "string" && message.name.trim().length > 0) {
        player.name = message.name.slice(0, 24);
      }
    });

    // Auto-dispose room once empty after a short delay.
    this.setPatchRate(50);
    this.setSimulationInterval(() => {
      // Simulation loop not needed yet; state is message-driven.
    }, 1000 / 20);
  }

  onJoin(client: Client): void {
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = `Player-${client.sessionId.slice(0, 4)}`;
    player.x = Math.random() * 4 - 2;
    player.y = 0;
    player.z = Math.random() * 4 - 2;
    player.rotY = 0;

    this.state.players.set(client.sessionId, player);
    console.log(`[LobbyRoom] join ${client.sessionId}`);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    console.log(`[LobbyRoom] leave ${client.sessionId}`);
  }

  onDispose(): void {
    console.log("[LobbyRoom] disposed");
  }
}
