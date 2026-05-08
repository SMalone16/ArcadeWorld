import { Schema, type } from "@colyseus/schema";

/**
 * Represents one player in the room state.
 * Kept intentionally small for the first multiplayer slice.
 */
export class PlayerState extends Schema {
  @type("string")
  id = "";

  @type("string")
  name = "Player";

  @type("string")
  color = "#44aaff";

  @type("string")
  hatId = "No Hat";

  @type("number")
  x = 0;

  @type("number")
  y = 0;

  @type("number")
  z = 0;

  @type("number")
  rotY = 0;

  @type("string")
  manhuntTeam = "none";

  @type("string")
  manhuntStatus = "none";

  @type("number")
  manhuntPoints = 0;

  @type("number")
  totalPoints = 0;

  @type("boolean")
  isInManhuntRound = false;
}
