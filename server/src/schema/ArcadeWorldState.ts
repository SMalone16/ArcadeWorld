import { MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState.js";
import { ManhuntState } from "./ManhuntState.js";

/**
 * Shared lobby room state synchronized to all connected clients.
 */
export class ArcadeWorldState extends Schema {
  @type({ map: PlayerState })
  players: MapSchema<PlayerState>;

  @type(ManhuntState)
  manhunt: ManhuntState;

  constructor() {
    super();
    this.players = new MapSchema<PlayerState>();
    this.manhunt = new ManhuntState();
  }
}
