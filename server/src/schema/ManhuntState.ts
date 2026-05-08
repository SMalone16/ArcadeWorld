import { Schema, type } from "@colyseus/schema";

/**
 * Server-owned state for the multiplayer Manhunt round.
 * Clients render this state but do not decide round phase, teams, or scoring.
 */
export class ManhuntState extends Schema {
  @type("string")
  phase = "lobby";

  @type("number")
  timerSeconds = 0;

  @type("number")
  roundNumber = 0;

  @type("string")
  message = "Go to Home Base and press M to start Manhunt.";

  @type("string")
  startedBy = "";

  @type("number")
  safeZoneX = 0;

  @type("number")
  safeZoneY = 0;

  @type("number")
  safeZoneZ = 0;

  @type("number")
  safeZoneRadius = 2.6;

  @type("number")
  hiderStartX = -12;

  @type("number")
  hiderStartY = 0;

  @type("number")
  hiderStartZ = -12;

  @type("number")
  seekerStartX = 12;

  @type("number")
  seekerStartY = 0;

  @type("number")
  seekerStartZ = 12;

  @type("number")
  lobbySpawnX = 0;

  @type("number")
  lobbySpawnY = 0;

  @type("number")
  lobbySpawnZ = 0;
}
