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
  safeZoneX = 276.6;

  @type("number")
  safeZoneY = -0.19;

  @type("number")
  safeZoneZ = -222;

  @type("number")
  safeZoneRadius = 15;

  @type("number")
  hiderStartX = 276.6;

  @type("number")
  hiderStartY = 1.81;

  @type("number")
  hiderStartZ = -242;

  @type("number")
  seekerStartX = 296.6;

  @type("number")
  seekerStartY = 1.81;

  @type("number")
  seekerStartZ = -222;

  @type("number")
  lobbySpawnX = 276.6;

  @type("number")
  lobbySpawnY = 1.81;

  @type("number")
  lobbySpawnZ = -222;
}
