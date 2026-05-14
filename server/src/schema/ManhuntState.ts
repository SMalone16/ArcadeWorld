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
  hiderStartAX = 285;

  @type("number")
  hiderStartAY = 0.5;

  @type("number")
  hiderStartAZ = -88;

  @type("number")
  hiderStartBX = 295;

  @type("number")
  hiderStartBY = 0.5;

  @type("number")
  hiderStartBZ = -88;

  @type("number")
  hiderStartCX = 275;

  @type("number")
  hiderStartCY = 0.5;

  @type("number")
  hiderStartCZ = -88;

  @type("number")
  seekerStartX = 276.6;

  @type("number")
  seekerStartY = 0.5;

  @type("number")
  seekerStartZ = -222;

  @type("number")
  lobbySpawnX = 276.6;

  @type("number")
  lobbySpawnY = 0.5;

  @type("number")
  lobbySpawnZ = -222;
}
