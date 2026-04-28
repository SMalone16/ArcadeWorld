import { Schema, type } from "@colyseus/schema";

/**
 * Represents one player in the room state.
 * Kept intentionally small for the first multiplayer slice.
 */
export class PlayerState extends Schema {
  @type("string")
  name = "Player";

  @type("number")
  x = 0;

  @type("number")
  y = 0;

  @type("number")
  z = 0;

  @type("number")
  yaw = 0;
}
