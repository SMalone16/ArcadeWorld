import { MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState.js";

/**
 * Shared lobby room state synchronized to all connected clients.
 */
export class ArcadeWorldState extends Schema {
  @type({ map: PlayerState })
  players: MapSchema<PlayerState>;

  constructor() {
    super();
    this.players = new MapSchema<PlayerState>();
  }
}
