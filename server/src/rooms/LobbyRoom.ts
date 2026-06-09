import { Client, Room } from "@colyseus/core";
import { ArcadeWorldState } from "../schema/ArcadeWorldState.js";
import { PlayerState } from "../schema/PlayerState.js";
import { TicketPickupState } from "../schema/TicketPickupState.js";

type MovementMessage = {
  x: number;
  y: number;
  z: number;
  rotY?: number;
  yaw?: number;
  name?: string;
};

type ProfileMessage = {
  name?: string;
  color?: string;
  hatId?: string;
  savedTickets?: number;
  deviceId?: string;
};

type Vec3 = { x: number; y: number; z: number };

type TicketSpawnConfigMessage = { positions?: Vec3[] | null };
type TicketCollectRequestMessage = {
  ticketId?: string;
  playerPosition?: Vec3 | null;
};
type MiniGameTicketAwardMessage = {
  source?: string;
  score?: number;
  tickets?: number;
};

const TICKET_SPAWN_COUNT = 16;
const TICKET_ACTIVE_COUNT = 10;
const TICKET_COLLECT_DISTANCE = 2.5;
const TICKET_COLLECT_VERTICAL_TOLERANCE = 3;
const TICKET_RESPAWN_MIN_MS = 5000;
const TICKET_RESPAWN_MAX_MS = 10000;
const MINI_GAME_MIN_TICKETS = 1;
const MINI_GAME_MAX_TICKETS = 10;

type ManhuntMapConfigMessage = {
  safeZone?: (Vec3 & { radius?: number }) | null;
  seekerStart?: Vec3 | null;
  hiderStarts?: Vec3[] | null;
  lobbySpawn?: Vec3 | null;
  spectatorCamera?:
    | (Vec3 & { rotX?: number; rotY?: number; rotZ?: number })
    | null;
};

type ManhuntPhase =
  | "lobby"
  | "teamReveal"
  | "spawnCountdown"
  | "activeRound"
  | "roundOver";
type ManhuntTeam = "none" | "hider" | "seeker";
type ManhuntStatus = "none" | "active" | "safe" | "tagged";
type ManhuntActionType = "tagged" | "safe" | "roundStart" | "roundOver";
type ManhuntActionEvent = {
  type: ManhuntActionType;
  message: string;
  actorId: string;
  actorName: string;
  targetId: string;
  targetName: string;
  x: number;
  y: number;
  z: number;
  timestamp: number;
};

type ManhuntStartDebugMessage = {
  localPlayer?: Vec3 | null;
  safeZoneEntity?: Vec3 | null;
  clientDistanceXZ?: number | null;
  clientSafeZoneRadius?: number | null;
  serverSafeZone?: (Vec3 & { radius: number }) | null;
  localSessionId?: string;
  localDisplayName?: string;
};

type PlayerPositionCaptureMessage = {
  position?: Vec3 | null;
  label?: string;
  localSessionId?: string;
  localDisplayName?: string;
};

const DEFAULT_COLOR = "#44aaff";
const DEFAULT_HAT_ID = "No Hat";
const SAFE_HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const ALLOWED_HAT_IDS = new Set(["No Hat", "Top Hat", "Western"]);

// These Manhunt coordinates are server-authoritative PlayCanvas world-space positions.
// Home Base is a marker/collider center. Spawn positions below are player-root positions,
// not visual floor positions, so keep PlayCanvas marker entities in sync with these values.
const MANHUNT_HOME_BASE: Vec3 = { x: 276.6, y: -0.19, z: -222 };
const MANHUNT_SAFE_ZONE_RADIUS = 15;
const HIDER_STARTS: Vec3[] = [
  { x: 285, y: 0.5, z: -88 },
  { x: 295, y: 0.5, z: -88 },
  { x: 275, y: 0.5, z: -88 },
];
const SEEKER_START: Vec3 = { x: 276.6, y: 0.5, z: -222 };
const LOBBY_SPAWN: Vec3 = { x: 276.6, y: 0.5, z: -222 };

const TEAM_REVEAL_SECONDS = 5;
const ROUND_START_COUNTDOWN_SECONDS = 5;
const ACTIVE_ROUND_SECONDS = 60;
const ROUND_OVER_SECONDS = 30;
const MANHUNT_TAG_DISTANCE = 2.2;
const MANHUNT_TICK_MS = 1000;

// Classroom/dev convenience: lets PlayCanvas marker entities seed Manhunt coordinates.
// Production server-authoritative maps should load trusted config/server map data instead
// of trusting arbitrary client-provided coordinates.
const ALLOW_CLIENT_MAP_CONFIG = true;
const MIN_SAFE_ZONE_RADIUS = 1;
const MAX_SAFE_ZONE_RADIUS = 200;

function sanitizeName(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim().slice(0, 24);
  return trimmed.length > 0 ? trimmed : fallback;
}

function sanitizeColor(value: unknown, fallback = DEFAULT_COLOR): string {
  if (typeof value === "string" && SAFE_HEX_COLOR.test(value)) {
    return value;
  }

  return fallback;
}

function sanitizeHatId(value: unknown, fallback = DEFAULT_HAT_ID): string {
  if (typeof value === "string" && ALLOWED_HAT_IDS.has(value)) {
    return value;
  }

  return fallback;
}

function distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function distanceXZ(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function formatVec3(position: Vec3): string {
  return `(${position.x}, ${position.y}, ${position.z})`;
}

function isFiniteVec3(value: unknown): value is Vec3 {
  const position = value as Vec3 | null | undefined;
  return (
    !!position &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    Number.isFinite(position.z)
  );
}

function copyVec3(position: Vec3): Vec3 {
  return { x: position.x, y: position.y, z: position.z };
}

/**
 * Single shared room for today's vertical slice.
 * Room name: arcade_lobby
 */
export class LobbyRoom extends Room<ArcadeWorldState> {
  maxClients = 64;

  private lastRoundTeams = new Map<string, ManhuntTeam>();
  private ticketSpawnPositions: Vec3[] = [];
  private nextTicketIdNumber = 1;
  private ticketRespawnTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  static logManhuntStartupConfig(): void {
    console.log(
      `[Manhunt] Home Base configured at (${MANHUNT_HOME_BASE.x}, ${MANHUNT_HOME_BASE.y}, ${MANHUNT_HOME_BASE.z}), radius ${MANHUNT_SAFE_ZONE_RADIUS}`,
    );
    console.log(
      `[Manhunt] HiderStarts configured at ${HIDER_STARTS.map(formatVec3).join(", ")}`,
    );
    console.log(
      `[Manhunt] SeekerStart configured at ${formatVec3(SEEKER_START)}`,
    );
    console.log(
      `[Manhunt] LobbySpawn configured at ${formatVec3(LOBBY_SPAWN)}`,
    );
  }

  onCreate(): void {
    this.setState(new ArcadeWorldState());
    this.configureManhuntDefaults();

    this.onMessage("profile", (client, message: ProfileMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        return;
      }

      player.name = sanitizeName(message?.name, player.name);
      player.color = sanitizeColor(message?.color, player.color);
      player.hatId = sanitizeHatId(message?.hatId, player.hatId);
      player.tickets = this.sanitizeTicketCount(
        message?.savedTickets,
        player.tickets,
      );
    });

    this.onMessage(
      "tickets:spawnConfig",
      (client, message: TicketSpawnConfigMessage) => {
        this.handleTicketSpawnConfig(client, message);
      },
    );

    this.onMessage(
      "tickets:collectRequest",
      (client, message: TicketCollectRequestMessage) => {
        this.handleTicketCollectRequest(client, message);
      },
    );

    this.onMessage(
      "tickets:awardFromMiniGame",
      (client, message: MiniGameTicketAwardMessage) => {
        this.handleMiniGameTicketAward(client, message);
      },
    );

    this.onMessage("manhunt:startRequest", (client) => {
      this.handleManhuntStartRequest(client);
    });

    this.onMessage(
      "manhunt:mapConfig",
      (client, message: ManhuntMapConfigMessage) => {
        this.handleManhuntMapConfig(client, message);
      },
    );

    this.onMessage(
      "debug:manhuntStartAttempt",
      (client, message: ManhuntStartDebugMessage) => {
        console.log(
          `[ManhuntDebug] debug:manhuntStartAttempt from ${this.playerLabel(client.sessionId)} ` +
            JSON.stringify(message, null, 2),
        );
      },
    );

    this.onMessage(
      "debug:playerPositionCapture",
      (client, message: PlayerPositionCaptureMessage) => {
        this.logPlayerPositionCapture(client, message);
      },
    );

    this.onMessage("manhunt:tagRequest", (client) => {
      this.handleManhuntTagRequest(client);
    });

    this.onMessage("move", (client, message: MovementMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) {
        return;
      }

      if (
        !Number.isFinite(message.x) ||
        !Number.isFinite(message.y) ||
        !Number.isFinite(message.z)
      ) {
        return;
      }

      if (this.canPlayerMove(player)) {
        player.x = message.x;
        player.y = message.y;
        player.z = message.z;
      }

      const rotY =
        typeof message.rotY === "number"
          ? message.rotY
          : typeof message.yaw === "number"
            ? message.yaw
            : undefined;

      if (
        this.canPlayerMove(player) &&
        typeof rotY === "number" &&
        Number.isFinite(rotY)
      ) {
        player.rotY = rotY;
      }

      player.name = sanitizeName(message.name, player.name);
    });

    this.setPatchRate(50);
    this.setSimulationInterval(() => {
      this.updateManhuntTimer();
    }, MANHUNT_TICK_MS);
  }

  onJoin(client: Client): void {
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = `Player-${client.sessionId.slice(0, 4)}`;
    player.color = DEFAULT_COLOR;
    player.hatId = DEFAULT_HAT_ID;
    player.x = Math.random() * 4 - 2;
    player.y = 0;
    player.z = Math.random() * 4 - 2;
    player.rotY = 0;
    this.resetPlayerManhuntFields(player, false);
    player.tickets = 0;

    this.state.players.set(client.sessionId, player);
    console.log(`[LobbyRoom] join ${client.sessionId}`);
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    console.log(`[LobbyRoom] leave ${client.sessionId}`);

    if (this.isRoundActive() && this.getHiders().length === 0) {
      this.finishManhuntRound("Round ended because all hiders left.");
    }
  }

  onDispose(): void {
    for (const timer of this.ticketRespawnTimers.values()) clearTimeout(timer);
    this.ticketRespawnTimers.clear();
    console.log("[LobbyRoom] disposed");
  }

  private configureManhuntDefaults(): void {
    const manhunt = this.state.manhunt;
    manhunt.phase = "lobby";
    manhunt.timerSeconds = 0;
    manhunt.roundNumber = 0;
    manhunt.message = "Go to Home Base and press M to start Manhunt.";
    manhunt.startedBy = "";
    // Home Base/Safe Zone and starts are shared PlayCanvas coordinates for this slice.
    manhunt.safeZoneX = MANHUNT_HOME_BASE.x;
    manhunt.safeZoneY = MANHUNT_HOME_BASE.y;
    manhunt.safeZoneZ = MANHUNT_HOME_BASE.z;
    manhunt.safeZoneRadius = MANHUNT_SAFE_ZONE_RADIUS;
    const hiderStarts = HIDER_STARTS;
    const seekerStart = SEEKER_START;
    const lobbySpawn = LOBBY_SPAWN;
    this.setHiderStarts(hiderStarts);
    manhunt.seekerStartX = seekerStart.x;
    manhunt.seekerStartY = seekerStart.y;
    manhunt.seekerStartZ = seekerStart.z;
    manhunt.lobbySpawnX = lobbySpawn.x;
    manhunt.lobbySpawnY = lobbySpawn.y;
    manhunt.lobbySpawnZ = lobbySpawn.z;

    this.logManhuntConfig();
  }

  private handleManhuntMapConfig(
    client: Client,
    message: ManhuntMapConfigMessage,
  ): void {
    if (!ALLOW_CLIENT_MAP_CONFIG) {
      console.log(
        `[ManhuntMapConfig] Ignored map config from ${this.playerLabel(client.sessionId)} because ALLOW_CLIENT_MAP_CONFIG=false`,
      );
      return;
    }

    if (this.state.manhunt.phase !== "lobby") {
      const feedback = "Map config ignored because Manhunt is active.";
      console.log(
        `[ManhuntMapConfig] ${feedback} Sender=${this.playerLabel(client.sessionId)}`,
      );
      client.send("manhunt:feedback", { message: feedback });
      return;
    }

    const safeZone = message?.safeZone;
    const seekerStart = message?.seekerStart;
    const lobbySpawn = message?.lobbySpawn;
    const hiderStarts = Array.isArray(message?.hiderStarts)
      ? message.hiderStarts
      : [];
    const safeZoneRadius = safeZone?.radius;
    if (
      !isFiniteVec3(safeZone) ||
      typeof safeZoneRadius !== "number" ||
      !Number.isFinite(safeZoneRadius) ||
      safeZoneRadius < MIN_SAFE_ZONE_RADIUS ||
      safeZoneRadius > MAX_SAFE_ZONE_RADIUS ||
      !isFiniteVec3(seekerStart) ||
      !isFiniteVec3(lobbySpawn) ||
      hiderStarts.length !== 3 ||
      !hiderStarts.every(isFiniteVec3)
    ) {
      console.log(
        `[ManhuntMapConfig] Invalid map config ignored from ${this.playerLabel(client.sessionId)}`,
      );
      client.send("manhunt:feedback", {
        message: "Map config ignored because it was invalid.",
      });
      return;
    }

    const manhunt = this.state.manhunt;
    manhunt.safeZoneX = safeZone.x;
    manhunt.safeZoneY = safeZone.y;
    manhunt.safeZoneZ = safeZone.z;
    manhunt.safeZoneRadius = safeZoneRadius;
    manhunt.seekerStartX = seekerStart.x;
    manhunt.seekerStartY = seekerStart.y;
    manhunt.seekerStartZ = seekerStart.z;
    manhunt.lobbySpawnX = lobbySpawn.x;
    manhunt.lobbySpawnY = lobbySpawn.y;
    manhunt.lobbySpawnZ = lobbySpawn.z;
    this.setHiderStarts(hiderStarts.map(copyVec3));

    console.log(
      `[ManhuntMapConfig] Received map config from ${this.playerLabel(client.sessionId)}`,
    );
    console.log(
      `[ManhuntMapConfig] SafeZone ${formatVec3(this.getSafeZone())}, radius ${manhunt.safeZoneRadius}`,
    );
    this.getHiderStarts().forEach((start, index) => {
      console.log(
        `[ManhuntMapConfig] HiderStart${String.fromCharCode(65 + index)} ${formatVec3(start)}`,
      );
    });
    console.log(
      `[ManhuntMapConfig] SeekerStart ${formatVec3(this.getSeekerStart())}`,
    );
    console.log(
      `[ManhuntMapConfig] LobbySpawn ${formatVec3(this.getLobbySpawn())}`,
    );
  }

  private handleManhuntStartRequest(client: Client): void {
    const requester = this.state.players.get(client.sessionId);
    console.log(
      `[Manhunt] start request received from ${this.playerLabel(client.sessionId)}`,
    );

    if (!requester) {
      return;
    }

    const phase = this.state.manhunt.phase as ManhuntPhase;
    if (phase !== "lobby") {
      this.rejectManhuntRequest(client, "A Manhunt round is already running.");
      return;
    }

    const players = Array.from(this.state.players.entries());
    if (players.length < 2) {
      this.rejectManhuntRequest(client, "Need at least 2 players.");
      return;
    }

    const requesterPosition = this.playerPosition(requester);
    const safeZone = this.getSafeZone();
    const fullDistance = distance(requesterPosition, safeZone);
    const xzDistance = distanceXZ(requesterPosition, safeZone);
    const radius = this.state.manhunt.safeZoneRadius;
    const isInsideHomeBase = xzDistance <= radius;

    console.log(
      `[ManhuntDebug] Home Base start validation: requester=${requester.name} (${client.sessionId}), ` +
        `serverKnownPlayerPosition=(${requesterPosition.x}, ${requesterPosition.y}, ${requesterPosition.z}), ` +
        `serverHomeBase=(${safeZone.x}, ${safeZone.y}, ${safeZone.z}), radius=${radius}, ` +
        `distance=${fullDistance.toFixed(2)}, distanceXZ=${xzDistance.toFixed(2)}, inside=${isInsideHomeBase}`,
    );

    if (!this.isPlayerInSafeZone(requester)) {
      this.rejectManhuntRequest(
        client,
        `Go to Home Base to start Manhunt. Distance: ${xzDistance.toFixed(2)} / Radius: ${radius}`,
      );
      return;
    }

    this.startManhuntRound(client.sessionId, players);
  }

  private rejectManhuntRequest(client: Client, reason: string): void {
    console.log(
      `[Manhunt] start request rejected for ${this.playerLabel(client.sessionId)}: ${reason}`,
    );
    client.send("manhunt:feedback", { message: reason });
    this.state.manhunt.message = reason;
  }

  private startManhuntRound(
    startedBy: string,
    entries: [string, PlayerState][],
  ): void {
    const sorted = [...entries].sort(([a], [b]) => a.localeCompare(b));
    const nextRoundNumber = this.state.manhunt.roundNumber + 1;
    const shuffled = this.chooseBalancedShuffledEntries(sorted);
    const seekerCount = Math.max(1, Math.floor(shuffled.length / 2));
    const seekerIds = new Set(
      shuffled.slice(0, seekerCount).map(([sessionId]) => sessionId),
    );

    this.state.manhunt.roundNumber = nextRoundNumber;
    this.state.manhunt.startedBy = startedBy;
    this.state.manhunt.phase = "teamReveal";
    this.state.manhunt.timerSeconds = TEAM_REVEAL_SECONDS;
    this.state.manhunt.message = "Teams assigned. Get ready for Manhunt.";

    this.lastRoundTeams.clear();
    for (const [sessionId, player] of sorted) {
      const team: ManhuntTeam = seekerIds.has(sessionId) ? "seeker" : "hider";
      player.manhuntTeam = team;
      player.manhuntStatus = "active";
      player.manhuntPoints = 0;
      player.isInManhuntRound = true;
      this.lastRoundTeams.set(sessionId, team);
      console.log(
        `[Manhunt] randomized team assignment round ${nextRoundNumber}: ${this.playerLabel(sessionId)} -> ${team}`,
      );
    }

    console.log(
      `[Manhunt] phase changed -> teamReveal (${TEAM_REVEAL_SECONDS}s), seekers=${Array.from(
        seekerIds,
      )
        .map((id) => this.playerLabel(id))
        .join(", ")}`,
    );
  }

  private updateManhuntTimer(): void {
    const manhunt = this.state.manhunt;
    const phase = manhunt.phase as ManhuntPhase;

    if (phase === "lobby") {
      return;
    }

    if (phase === "activeRound") {
      this.checkSafeZoneEntries();
      if (this.areAllHidersResolved()) {
        this.finishManhuntRound("All hiders are safe or tagged!");
        return;
      }
    }

    manhunt.timerSeconds = Math.max(0, manhunt.timerSeconds - 1);
    if (manhunt.timerSeconds > 0) {
      return;
    }

    if (phase === "teamReveal") {
      this.teleportPlayersToManhuntStarts();
      this.setManhuntPhase(
        "spawnCountdown",
        ROUND_START_COUNTDOWN_SECONDS,
        "Round starts soon. Get ready!",
      );
      return;
    }

    if (phase === "spawnCountdown") {
      this.setManhuntPhase(
        "activeRound",
        ACTIVE_ROUND_SECONDS,
        "Manhunt is live!",
      );
      return;
    }

    if (phase === "activeRound") {
      this.finishManhuntRound("Time is up!");
      return;
    }

    if (phase === "roundOver") {
      this.resetManhuntToLobby();
    }
  }

  private setManhuntPhase(
    phase: ManhuntPhase,
    seconds: number,
    message: string,
  ): void {
    this.state.manhunt.phase = phase;
    this.state.manhunt.timerSeconds = seconds;
    this.state.manhunt.message = message;
    console.log(
      `[Manhunt] phase changed -> ${phase} (${seconds}s): ${message}`,
    );
    if (phase === "activeRound") {
      this.broadcastManhuntAction({
        type: "roundStart",
        message: "Round started! Hiders run, seekers tag.",
        actorId: "",
        actorName: "",
        targetId: "",
        targetName: "",
        x: this.state.manhunt.safeZoneX,
        y: this.state.manhunt.safeZoneY,
        z: this.state.manhunt.safeZoneZ,
        timestamp: Date.now(),
      });
    }
  }

  private broadcastManhuntAction(event: ManhuntActionEvent): void {
    this.broadcast("manhunt:action", event);
  }

  private handleManhuntTagRequest(client: Client): void {
    const seeker = this.state.players.get(client.sessionId);
    if (
      !seeker ||
      this.state.manhunt.phase !== "activeRound" ||
      seeker.manhuntTeam !== "seeker" ||
      seeker.manhuntStatus !== "active"
    ) {
      client.send("manhunt:feedback", {
        message: "Only seekers can tag during the active round.",
      });
      return;
    }

    const nearest = this.findNearestActiveHider(seeker);
    if (!nearest) {
      client.send("manhunt:feedback", {
        message: "No active hider is close enough to tag.",
      });
      return;
    }

    nearest.player.manhuntStatus = "tagged";
    seeker.manhuntPoints += 3;
    seeker.totalPoints += 3;
    this.state.manhunt.message = `${seeker.name} tagged ${nearest.player.name}!`;
    this.broadcastManhuntAction({
      type: "tagged",
      message: `${seeker.name} tagged ${nearest.player.name}!`,
      actorId: client.sessionId,
      actorName: seeker.name,
      targetId: nearest.sessionId,
      targetName: nearest.player.name,
      x: nearest.player.x,
      y: nearest.player.y,
      z: nearest.player.z,
      timestamp: Date.now(),
    });
    console.log(
      `[Manhunt] tag: ${this.playerLabel(client.sessionId)} tagged ${this.playerLabel(nearest.sessionId)} (+3 seeker points)`,
    );

    if (this.areAllHidersResolved()) {
      this.finishManhuntRound("All hiders are safe or tagged!");
    }
  }

  private findNearestActiveHider(
    seeker: PlayerState,
  ): { sessionId: string; player: PlayerState; distance: number } | null {
    let closest: {
      sessionId: string;
      player: PlayerState;
      distance: number;
    } | null = null;
    const seekerPosition = this.playerPosition(seeker);

    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.manhuntTeam !== "hider" || player.manhuntStatus !== "active") {
        continue;
      }

      const currentDistance = distance(
        seekerPosition,
        this.playerPosition(player),
      );
      if (
        currentDistance <= MANHUNT_TAG_DISTANCE &&
        (!closest || currentDistance < closest.distance)
      ) {
        closest = { sessionId, player, distance: currentDistance };
      }
    }

    return closest;
  }

  private checkSafeZoneEntries(): void {
    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.manhuntTeam !== "hider" || player.manhuntStatus !== "active") {
        continue;
      }

      if (!this.isPlayerInSafeZone(player)) {
        continue;
      }

      player.manhuntStatus = "safe";
      player.manhuntPoints += 3;
      player.totalPoints += 3;
      this.state.manhunt.message = `${player.name} reached Home Base!`;
      this.broadcastManhuntAction({
        type: "safe",
        message: `${player.name} reached Home Base safely!`,
        actorId: sessionId,
        actorName: player.name,
        targetId: "",
        targetName: "",
        x: player.x,
        y: player.y,
        z: player.z,
        timestamp: Date.now(),
      });
      console.log(
        `[Manhunt] safe event: ${this.playerLabel(sessionId)} reached Home Base (+3 hider points)`,
      );
    }
  }

  private finishManhuntRound(reason: string): void {
    if (
      this.state.manhunt.phase === "roundOver" ||
      this.state.manhunt.phase === "lobby"
    ) {
      return;
    }

    for (const [, player] of this.state.players.entries()) {
      if (player.manhuntTeam === "hider" && player.manhuntStatus === "active") {
        player.manhuntPoints += 1;
        player.totalPoints += 1;
      }
    }

    this.setManhuntPhase(
      "roundOver",
      ROUND_OVER_SECONDS,
      this.buildRoundOverMessage(reason),
    );
    this.broadcastManhuntAction({
      type: "roundOver",
      message: `Round over: ${reason}`,
      actorId: "",
      actorName: "",
      targetId: "",
      targetName: "",
      x: this.state.manhunt.safeZoneX,
      y: this.state.manhunt.safeZoneY,
      z: this.state.manhunt.safeZoneZ,
      timestamp: Date.now(),
    });
    console.log(`[Manhunt] round over: ${reason}`);
  }

  private resetManhuntToLobby(): void {
    this.state.manhunt.phase = "lobby";
    this.state.manhunt.timerSeconds = 0;
    this.state.manhunt.message =
      "Go to Home Base and press M to start Manhunt.";
    this.state.manhunt.startedBy = "";

    this.teleportManhuntPlayers(this.getLobbySpawn());

    for (const [, player] of this.state.players.entries()) {
      this.resetPlayerManhuntFields(player, true);
    }

    console.log(
      "[Manhunt] phase changed -> lobby; players returned to free roam",
    );
  }

  private resetPlayerManhuntFields(
    player: PlayerState,
    keepPoints: boolean,
  ): void {
    player.manhuntTeam = "none";
    player.manhuntStatus = "none";
    player.isInManhuntRound = false;
    if (!keepPoints) {
      player.manhuntPoints = 0;
      player.totalPoints = 0;
    }
  }

  private teleportManhuntPlayers(position: Vec3): void {
    let offset = 0;
    for (const [, player] of this.state.players.entries()) {
      this.teleportPlayer(player, {
        x: position.x + offset,
        y: position.y,
        z: position.z,
      });
      offset += 1.5;
    }
  }

  private teleportPlayer(player: PlayerState, position: Vec3): void {
    player.x = position.x;
    player.y = position.y;
    player.z = position.z;
    player.serverTeleportId += 1;
  }

  private canPlayerMove(player: PlayerState): boolean {
    const phase = this.state.manhunt.phase as ManhuntPhase;
    if (
      phase === "teamReveal" ||
      phase === "spawnCountdown" ||
      phase === "roundOver"
    ) {
      return false;
    }

    if (player.manhuntStatus === "tagged" || player.manhuntStatus === "safe") {
      return false;
    }

    return true;
  }

  private chooseBalancedShuffledEntries(
    entries: [string, PlayerState][],
  ): [string, PlayerState][] {
    let best = this.shuffleEntries(entries);
    let bestChangedCount = this.countTeamChanges(best);

    // Try a few random balanced candidates to reduce frustrating repeated roles
    // without making team assignment deterministic again.
    for (let attempt = 1; attempt < 8; attempt += 1) {
      const candidate = this.shuffleEntries(entries);
      const changedCount = this.countTeamChanges(candidate);
      if (changedCount > bestChangedCount) {
        best = candidate;
        bestChangedCount = changedCount;
      }
    }

    return best;
  }

  private countTeamChanges(entries: [string, PlayerState][]): number {
    const seekerCount = Math.max(1, Math.floor(entries.length / 2));
    let changes = 0;
    entries.forEach(([sessionId], index) => {
      const nextTeam: ManhuntTeam = index < seekerCount ? "seeker" : "hider";
      const previousTeam = this.lastRoundTeams.get(sessionId);
      if (previousTeam && previousTeam !== nextTeam) {
        changes += 1;
      }
    });
    return changes;
  }

  private shuffleEntries(
    entries: [string, PlayerState][],
  ): [string, PlayerState][] {
    const shuffled = [...entries];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private teleportPlayersToManhuntStarts(): void {
    let hiderIndex = 0;
    for (const [sessionId, player] of this.state.players.entries()) {
      if (!player.isInManhuntRound) {
        continue;
      }

      const hiderStarts = this.getHiderStarts();
      const spawn =
        player.manhuntTeam === "seeker"
          ? this.getSeekerStart()
          : hiderStarts[hiderIndex++ % hiderStarts.length];
      const spawnName =
        player.manhuntTeam === "seeker"
          ? "SeekerStart"
          : `HiderStart${String.fromCharCode(65 + ((hiderIndex - 1) % hiderStarts.length))}`;
      this.teleportPlayer(player, spawn);
      console.log(
        `[ManhuntDebug] teleporting ${this.playerLabel(sessionId)} as ${player.manhuntTeam} to ${spawnName} ${formatVec3(spawn)}`,
      );
    }
  }

  private buildRoundOverMessage(reason: string): string {
    const hiderScore = this.getTeamScore("hider");
    const seekerScore = this.getTeamScore("seeker");
    const winner =
      hiderScore > seekerScore
        ? "HIDERS WIN"
        : seekerScore > hiderScore
          ? "SEEKERS WIN"
          : "TIE ROUND";
    return `${winner} — ${reason}`;
  }

  private getTeamScore(team: ManhuntTeam): number {
    let score = 0;
    for (const [, player] of this.state.players.entries()) {
      if (player.manhuntTeam === team) {
        score += player.manhuntPoints;
      }
    }
    return score;
  }

  private isPlayerInSafeZone(player: PlayerState): boolean {
    return (
      distanceXZ(this.playerPosition(player), this.getSafeZone()) <=
      this.state.manhunt.safeZoneRadius
    );
  }

  private logManhuntConfig(): void {
    const safeZone = this.getSafeZone();
    const seekerStart = this.getSeekerStart();
    const lobbySpawn = this.getLobbySpawn();

    console.log(
      `[Manhunt] Home Base configured at ${formatVec3(safeZone)}, radius ${this.state.manhunt.safeZoneRadius}`,
    );
    console.log(
      `[Manhunt] HiderStarts configured at ${this.getHiderStarts().map(formatVec3).join(", ")}`,
    );
    console.log(
      `[Manhunt] SeekerStart configured at ${formatVec3(seekerStart)}`,
    );
    console.log(`[Manhunt] LobbySpawn configured at ${formatVec3(lobbySpawn)}`);
  }

  private logPlayerPositionCapture(
    client: Client,
    message: PlayerPositionCaptureMessage,
  ): void {
    const position = message?.position;
    if (
      !position ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y) ||
      !Number.isFinite(position.z)
    ) {
      console.log(
        `[ManhuntDebug] Position capture from ${this.playerLabel(client.sessionId)} ignored: invalid payload`,
      );
      return;
    }

    const label = sanitizeName(message.label, "standing at current position");
    const displayName = sanitizeName(
      message.localDisplayName,
      this.state.players.get(client.sessionId)?.name ?? "Player",
    );
    console.log(
      `[ManhuntDebug] Position capture from ${displayName} (${client.sessionId.slice(0, 4)}): ` +
        `${position.x}, ${position.y}, ${position.z} label=${label}`,
    );
  }

  private areAllHidersResolved(): boolean {
    const hiders = this.getHiders();
    return (
      hiders.length > 0 &&
      hiders.every(
        (player) =>
          player.manhuntStatus === "safe" || player.manhuntStatus === "tagged",
      )
    );
  }

  private getHiders(): PlayerState[] {
    return Array.from(this.state.players.values()).filter(
      (player) => player.manhuntTeam === "hider",
    );
  }

  private isRoundActive(): boolean {
    return ["teamReveal", "spawnCountdown", "activeRound"].includes(
      this.state.manhunt.phase,
    );
  }

  private playerPosition(player: PlayerState): Vec3 {
    return { x: player.x, y: player.y, z: player.z };
  }

  private getSafeZone(): Vec3 {
    return {
      x: this.state.manhunt.safeZoneX,
      y: this.state.manhunt.safeZoneY,
      z: this.state.manhunt.safeZoneZ,
    };
  }

  private getHiderStarts(): Vec3[] {
    const manhunt = this.state.manhunt;
    return [
      {
        x: manhunt.hiderStartAX,
        y: manhunt.hiderStartAY,
        z: manhunt.hiderStartAZ,
      },
      {
        x: manhunt.hiderStartBX,
        y: manhunt.hiderStartBY,
        z: manhunt.hiderStartBZ,
      },
      {
        x: manhunt.hiderStartCX,
        y: manhunt.hiderStartCY,
        z: manhunt.hiderStartCZ,
      },
    ];
  }

  private setHiderStarts(starts: Vec3[]): void {
    const manhunt = this.state.manhunt;
    const [a, b, c] = starts;
    manhunt.hiderStartAX = a.x;
    manhunt.hiderStartAY = a.y;
    manhunt.hiderStartAZ = a.z;
    manhunt.hiderStartBX = b.x;
    manhunt.hiderStartBY = b.y;
    manhunt.hiderStartBZ = b.z;
    manhunt.hiderStartCX = c.x;
    manhunt.hiderStartCY = c.y;
    manhunt.hiderStartCZ = c.z;
  }

  private getSeekerStart(): Vec3 {
    return {
      x: this.state.manhunt.seekerStartX,
      y: this.state.manhunt.seekerStartY,
      z: this.state.manhunt.seekerStartZ,
    };
  }

  private getLobbySpawn(): Vec3 {
    return {
      x: this.state.manhunt.lobbySpawnX,
      y: this.state.manhunt.lobbySpawnY,
      z: this.state.manhunt.lobbySpawnZ,
    };
  }

  private playerLabel(sessionId: string): string {
    const player = this.state.players.get(sessionId);
    return player
      ? `${player.name} (${sessionId.slice(0, 4)})`
      : sessionId.slice(0, 4);
  }

  private sanitizeTicketCount(value: unknown, fallback = 0): number {
    if (!Number.isFinite(value as number)) return fallback;
    return Math.max(0, Math.floor(value as number));
  }

  private handleTicketSpawnConfig(
    client: Client,
    message: TicketSpawnConfigMessage,
  ): void {
    const positions = message?.positions;
    const receivedCount = Array.isArray(positions) ? positions.length : 0;

    if (this.ticketSpawnPositions.length > 0) {
      client.send("tickets:spawnConfigResult", {
        accepted: false,
        reason: "ignored-already-configured",
        receivedCount,
        expectedCount: TICKET_SPAWN_COUNT,
        stateTicketCount: this.state.tickets.size,
        activeTicketCount: this.getActiveTicketCount(),
      });
      return;
    }

    if (!Array.isArray(positions) || positions.length !== TICKET_SPAWN_COUNT) {
      console.warn(
        `[Tickets] Rejected spawn config count from ${client.sessionId}. received=${receivedCount}`,
      );
      client.send("tickets:spawnConfigResult", {
        accepted: false,
        reason: "rejected-invalid-count",
        receivedCount,
        expectedCount: TICKET_SPAWN_COUNT,
        stateTicketCount: this.state.tickets.size,
        activeTicketCount: this.getActiveTicketCount(),
      });
      return;
    }

    if (positions.some((position) => !isFiniteVec3(position))) {
      console.warn(
        `[Tickets] Rejected spawn config invalid position payload from ${client.sessionId}`,
      );
      client.send("tickets:spawnConfigResult", {
        accepted: false,
        reason: "rejected-invalid-positions",
        receivedCount,
        expectedCount: TICKET_SPAWN_COUNT,
        stateTicketCount: this.state.tickets.size,
        activeTicketCount: this.getActiveTicketCount(),
      });
      return;
    }

    this.ticketSpawnPositions = positions.map(copyVec3);
    console.log(
      `[Tickets] Accepted spawn config with ${positions.length} positions.`,
    );
    this.seedInitialTickets();

    client.send("tickets:spawnConfigResult", {
      accepted: true,
      reason: "accepted-and-seeded",
      receivedCount,
      expectedCount: TICKET_SPAWN_COUNT,
      stateTicketCount: this.state.tickets.size,
      activeTicketCount: this.getActiveTicketCount(),
    });
  }

  private seedInitialTickets(): void {
    const shuffled = [...Array(TICKET_SPAWN_COUNT).keys()].sort(
      () => Math.random() - 0.5,
    );
    for (let i = 0; i < TICKET_ACTIVE_COUNT; i++) {
      this.createTicketAtSpawn(shuffled[i]);
    }
    console.log(
      `[Tickets] Spawned ${TICKET_ACTIVE_COUNT} active tickets with fresh ids. stateTicketCount=${this.state.tickets.size}, activeTicketCount=${this.getActiveTicketCount()}`,
    );
  }

  private createTicketAtSpawn(spawnIndex: number): TicketPickupState | null {
    const pos = this.ticketSpawnPositions[spawnIndex];
    if (!pos) {
      console.warn(`[Tickets] Cannot create ticket at missing spawn ${spawnIndex}`);
      return null;
    }

    const ticket = new TicketPickupState();
    ticket.id = `ticket-${this.nextTicketIdNumber++}`;
    ticket.spawnIndex = spawnIndex;
    ticket.x = pos.x;
    ticket.y = pos.y;
    ticket.z = pos.z;
    ticket.active = true;
    ticket.version = 1;
    this.state.tickets.set(ticket.id, ticket);
    return ticket;
  }

  private getActiveTicketCount(): number {
    let count = 0;
    this.state.tickets.forEach((ticket) => {
      if (ticket.active) count += 1;
    });
    return count;
  }

  private handleMiniGameTicketAward(
    client: Client,
    message: MiniGameTicketAwardMessage,
  ): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      client.send("tickets:miniGameAwarded", {
        accepted: false,
        reason: "missing-player",
        source: message?.source || "unknown",
        score: 0,
        ticketsAwarded: 0,
        totalTickets: 0,
      });
      return;
    }

    const score = Number.isFinite(message?.score)
      ? Math.max(0, Math.floor(message.score as number))
      : 0;
    const requestedTickets = Number.isFinite(message?.tickets)
      ? Math.floor(message.tickets as number)
      : MINI_GAME_MIN_TICKETS;
    const ticketsAwarded = Math.max(
      MINI_GAME_MIN_TICKETS,
      Math.min(MINI_GAME_MAX_TICKETS, requestedTickets),
    );
    const source = typeof message?.source === "string" && message.source.trim()
      ? message.source.trim().slice(0, 40)
      : "unknown-mini-game";

    player.tickets += ticketsAwarded;
    console.log(
      `[Tickets] Mini-game award: ${this.playerLabel(client.sessionId)} source=${source} ` +
        `score=${score} tickets=${ticketsAwarded} total=${player.tickets}`,
    );
    client.send("tickets:miniGameAwarded", {
      accepted: true,
      source,
      score,
      ticketsAwarded,
      totalTickets: player.tickets,
    });
  }

  private handleTicketCollectRequest(
    client: Client,
    message: TicketCollectRequestMessage,
  ): void {
    const player = this.state.players.get(client.sessionId);
    const requestedTicketId =
      typeof message?.ticketId === "string" ? message.ticketId : "";

    if (!player) {
      this.rejectTicketCollect(client, requestedTicketId, "missing-player");
      return;
    }

    // The client also sends a normal movement packet immediately before this request.
    // Copying this finite position into the authoritative room state keeps ticket
    // validation from using a stale previous patch when both messages arrive together.
    if (isFiniteVec3(message?.playerPosition) && this.canPlayerMove(player)) {
      player.x = message.playerPosition.x;
      player.y = message.playerPosition.y;
      player.z = message.playerPosition.z;
    }

    const ticket = requestedTicketId
      ? this.state.tickets.get(requestedTicketId)
      : undefined;
    if (!requestedTicketId) {
      this.rejectTicketCollect(
        client,
        requestedTicketId,
        "missing-ticket-id",
        player,
      );
      return;
    }
    if (!ticket) {
      this.rejectTicketCollect(
        client,
        requestedTicketId,
        "missing-ticket",
        player,
      );
      return;
    }
    if (!ticket.active) {
      this.rejectTicketCollect(
        client,
        requestedTicketId,
        "inactive-ticket",
        player,
        ticket,
      );
      return;
    }

    const playerPos = this.playerPosition(player);
    const ticketPos = { x: ticket.x, y: ticket.y, z: ticket.z };
    const fullDistance = distance(playerPos, ticketPos);
    const xzDistance = distanceXZ(playerPos, ticketPos);
    const verticalDistance = Math.abs(playerPos.y - ticketPos.y);

    if (
      xzDistance > TICKET_COLLECT_DISTANCE ||
      verticalDistance > TICKET_COLLECT_VERTICAL_TOLERANCE
    ) {
      this.rejectTicketCollect(
        client,
        requestedTicketId,
        "too-far",
        player,
        ticket,
      );
      return;
    }

    const collectedTicketId = ticket.id;
    const collectedPosition = ticketPos;
    player.tickets += 1;
    console.log(
      `[Tickets] ${client.sessionId} collected ${collectedTicketId} -> ${player.tickets} ` +
        `(distance=${fullDistance.toFixed(2)}, xz=${xzDistance.toFixed(2)}, vertical=${verticalDistance.toFixed(2)}). ` +
        `Removing collected ticket from state before scheduling fresh-id respawn.`,
    );
    client.send("tickets:collected", {
      ticketId: collectedTicketId,
      x: collectedPosition.x,
      y: collectedPosition.y,
      z: collectedPosition.z,
      tickets: player.tickets,
    });
    this.state.tickets.delete(collectedTicketId);
    this.scheduleTicketRespawn(collectedTicketId);
  }

  private rejectTicketCollect(
    client: Client,
    ticketId: string,
    reason: string,
    player?: PlayerState,
    ticket?: TicketPickupState,
  ): void {
    const playerPos = player ? this.playerPosition(player) : null;
    const ticketPos = ticket ? { x: ticket.x, y: ticket.y, z: ticket.z } : null;
    const fullDistance =
      playerPos && ticketPos ? distance(playerPos, ticketPos) : null;
    const xzDistance =
      playerPos && ticketPos ? distanceXZ(playerPos, ticketPos) : null;
    const verticalDistance =
      playerPos && ticketPos ? Math.abs(playerPos.y - ticketPos.y) : null;
    const payload = {
      reason,
      ticketId,
      playerPosition: playerPos,
      ticketPosition: ticketPos,
      distance: fullDistance,
      distanceXZ: xzDistance,
      verticalDistance,
      collectDistance: TICKET_COLLECT_DISTANCE,
      verticalTolerance: TICKET_COLLECT_VERTICAL_TOLERANCE,
      active: ticket ? ticket.active : null,
      hasRoomState: !!this.state,
      stateTicketCount: this.state.tickets.size,
      activeTicketCount: this.getActiveTicketCount(),
      hint:
        reason === "missing-ticket"
          ? "Ticket id is not in room state. It may have already been collected and removed before a fresh-id respawn."
          : "",
      timestamp: Date.now(),
    };

    const missingDetail =
      reason === "missing-ticket"
        ? ` requested old/missing ticket id=${ticketId}. stateTicketCount=${this.state.tickets.size}, activeTicketCount=${this.getActiveTicketCount()}`
        : "";
    console.warn(
      `[Tickets] Collect rejected for ${client.sessionId}:${missingDetail} ${JSON.stringify(payload)}`,
    );
    client.send("tickets:collectRejected", payload);
  }

  private scheduleTicketRespawn(collectedTicketId: string): void {
    const existing = this.ticketRespawnTimers.get(collectedTicketId);
    if (existing) clearTimeout(existing);
    const delay =
      TICKET_RESPAWN_MIN_MS +
      Math.floor(
        Math.random() * (TICKET_RESPAWN_MAX_MS - TICKET_RESPAWN_MIN_MS + 1),
      );
    const timer = setTimeout(() => {
      this.ticketRespawnTimers.delete(collectedTicketId);
      this.respawnTicket(collectedTicketId);
    }, delay);
    this.ticketRespawnTimers.set(collectedTicketId, timer);
    console.log(
      `[Tickets] Respawn scheduled for collected ${collectedTicketId} in ${delay}ms`,
    );
  }

  private respawnTicket(collectedTicketId: string): void {
    if (this.ticketSpawnPositions.length !== TICKET_SPAWN_COUNT) {
      console.warn(
        `[Tickets] Respawn skipped for collected ${collectedTicketId}: spawn config incomplete. positions=${this.ticketSpawnPositions.length}`,
      );
      return;
    }

    const used = new Set<number>();
    this.state.tickets.forEach((ticket) => {
      if (ticket.active) used.add(ticket.spawnIndex);
    });
    const available = [...Array(TICKET_SPAWN_COUNT).keys()].filter(
      (index) => !used.has(index),
    );
    const spawnIndex = available.length
      ? available[Math.floor(Math.random() * available.length)]
      : Math.floor(Math.random() * TICKET_SPAWN_COUNT);
    const ticket = this.createTicketAtSpawn(spawnIndex);

    console.log(
      `[Tickets] Respawned collected ${collectedTicketId} as ${ticket?.id ?? "none"} ` +
        `at spawn ${spawnIndex}. stateTicketCount=${this.state.tickets.size}, ` +
        `activeTicketCount=${this.getActiveTicketCount()}`,
    );
  }
}
