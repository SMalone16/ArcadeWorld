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

type ProfileMessage = {
  name?: string;
  color?: string;
  hatId?: string;
};

type Vec3 = { x: number; y: number; z: number };

type ManhuntPhase = "lobby" | "countdown" | "hidingPhase" | "seekingPhase" | "roundOver";
type ManhuntTeam = "none" | "hider" | "seeker";
type ManhuntStatus = "none" | "active" | "safe" | "tagged";

type ManhuntStartDebugMessage = {
  localPlayer?: Vec3 | null;
  safeZoneEntity?: Vec3 | null;
  clientDistanceXZ?: number | null;
  clientSafeZoneRadius?: number | null;
  serverSafeZone?: (Vec3 & { radius: number }) | null;
  localSessionId?: string;
  localDisplayName?: string;
};

const DEFAULT_COLOR = "#44aaff";
const DEFAULT_HAT_ID = "No Hat";
const SAFE_HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const ALLOWED_HAT_IDS = new Set(["No Hat", "Top Hat", "Western"]);

const MANHUNT_HOME_BASE: Vec3 = { x: 276.6, y: -0.19, z: -222 };
const MANHUNT_SAFE_ZONE_RADIUS = 15;
const MANHUNT_HIDER_START: Vec3 = { x: -12, y: 0, z: -12 };
const MANHUNT_SEEKER_START: Vec3 = { x: 12, y: 0, z: 12 };
const MANHUNT_LOBBY_SPAWN: Vec3 = { x: 0, y: 0, z: 0 };

const MANHUNT_COUNTDOWN_SECONDS = 5;
const MANHUNT_HIDING_SECONDS = 10;
const MANHUNT_SEEKING_SECONDS = 90;
const MANHUNT_RESULTS_SECONDS = 10;
const MANHUNT_TAG_DISTANCE = 2.2;
const MANHUNT_TICK_MS = 1000;

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

/**
 * Single shared room for today's vertical slice.
 * Room name: arcade_lobby
 */
export class LobbyRoom extends Room<ArcadeWorldState> {
  maxClients = 64;

  static logManhuntStartupConfig(): void {
    console.log(
      `[Manhunt] Home Base configured at (${MANHUNT_HOME_BASE.x}, ${MANHUNT_HOME_BASE.y}, ${MANHUNT_HOME_BASE.z}), radius ${MANHUNT_SAFE_ZONE_RADIUS}`,
    );
    console.log(
      `[Manhunt] HiderStart configured at (${MANHUNT_HIDER_START.x}, ${MANHUNT_HIDER_START.y}, ${MANHUNT_HIDER_START.z})`,
    );
    console.log(
      `[Manhunt] SeekerStart configured at (${MANHUNT_SEEKER_START.x}, ${MANHUNT_SEEKER_START.y}, ${MANHUNT_SEEKER_START.z})`,
    );
    console.log(
      `[Manhunt] LobbySpawn configured at (${MANHUNT_LOBBY_SPAWN.x}, ${MANHUNT_LOBBY_SPAWN.y}, ${MANHUNT_LOBBY_SPAWN.z})`,
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
    });

    this.onMessage("manhunt:startRequest", (client) => {
      this.handleManhuntStartRequest(client);
    });

    this.onMessage("debug:manhuntStartAttempt", (client, message: ManhuntStartDebugMessage) => {
      console.log(
        `[ManhuntDebug] debug:manhuntStartAttempt from ${this.playerLabel(client.sessionId)} ` +
          JSON.stringify(message, null, 2),
      );
    });

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

      if (this.shouldLockPlayerAtSeekerStart(player)) {
        this.teleportPlayer(player, this.getSeekerStart());
      } else {
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

      if (typeof rotY === "number" && Number.isFinite(rotY)) {
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
    manhunt.hiderStartX = MANHUNT_HIDER_START.x;
    manhunt.hiderStartY = MANHUNT_HIDER_START.y;
    manhunt.hiderStartZ = MANHUNT_HIDER_START.z;
    manhunt.seekerStartX = MANHUNT_SEEKER_START.x;
    manhunt.seekerStartY = MANHUNT_SEEKER_START.y;
    manhunt.seekerStartZ = MANHUNT_SEEKER_START.z;
    manhunt.lobbySpawnX = MANHUNT_LOBBY_SPAWN.x;
    manhunt.lobbySpawnY = MANHUNT_LOBBY_SPAWN.y;
    manhunt.lobbySpawnZ = MANHUNT_LOBBY_SPAWN.z;

    this.logManhuntConfig();
  }

  private handleManhuntStartRequest(client: Client): void {
    const requester = this.state.players.get(client.sessionId);
    console.log(`[Manhunt] start request received from ${this.playerLabel(client.sessionId)}`);

    if (!requester) {
      return;
    }

    const phase = this.state.manhunt.phase as ManhuntPhase;
    if (phase !== "lobby" && phase !== "roundOver") {
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
    console.log(`[Manhunt] start request rejected for ${this.playerLabel(client.sessionId)}: ${reason}`);
    client.send("manhunt:feedback", { message: reason });
    this.state.manhunt.message = reason;
  }

  private startManhuntRound(startedBy: string, entries: [string, PlayerState][]): void {
    const sorted = entries.sort(([a], [b]) => a.localeCompare(b));
    const nextRoundNumber = this.state.manhunt.roundNumber + 1;
    const seekerIndex = this.state.manhunt.roundNumber % sorted.length;
    const seekerId = sorted[seekerIndex][0];

    this.state.manhunt.roundNumber = nextRoundNumber;
    this.state.manhunt.startedBy = startedBy;
    this.state.manhunt.phase = "countdown";
    this.state.manhunt.timerSeconds = MANHUNT_COUNTDOWN_SECONDS;
    this.state.manhunt.message = "Teams assigned. Round starts soon!";

    for (const [sessionId, player] of sorted) {
      const team: ManhuntTeam = sessionId === seekerId ? "seeker" : "hider";
      player.manhuntTeam = team;
      player.manhuntStatus = "active";
      player.manhuntPoints = 0;
      player.isInManhuntRound = true;
      this.teleportPlayer(player, team === "seeker" ? this.getSeekerStart() : this.getHiderStart());
      console.log(`[Manhunt] team assignment: ${this.playerLabel(sessionId)} -> ${team}`);
    }

    console.log(`[Manhunt] phase changed -> countdown (${MANHUNT_COUNTDOWN_SECONDS}s), seeker=${this.playerLabel(seekerId)}`);
  }

  private updateManhuntTimer(): void {
    const manhunt = this.state.manhunt;
    const phase = manhunt.phase as ManhuntPhase;

    if (phase === "lobby") {
      return;
    }

    if (phase === "hidingPhase") {
      this.lockSeekersAtStart();
    }

    if (phase === "seekingPhase") {
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

    if (phase === "countdown") {
      this.setManhuntPhase("hidingPhase", MANHUNT_HIDING_SECONDS, "Hiders, run to Home Base!");
      return;
    }

    if (phase === "hidingPhase") {
      this.setManhuntPhase("seekingPhase", MANHUNT_SEEKING_SECONDS, "Seekers released! Tag hiders.");
      return;
    }

    if (phase === "seekingPhase") {
      this.finishManhuntRound("Time is up!");
      return;
    }

    if (phase === "roundOver") {
      this.resetManhuntToLobby();
    }
  }

  private setManhuntPhase(phase: ManhuntPhase, seconds: number, message: string): void {
    this.state.manhunt.phase = phase;
    this.state.manhunt.timerSeconds = seconds;
    this.state.manhunt.message = message;
    console.log(`[Manhunt] phase changed -> ${phase} (${seconds}s): ${message}`);
  }

  private handleManhuntTagRequest(client: Client): void {
    const seeker = this.state.players.get(client.sessionId);
    if (!seeker || this.state.manhunt.phase !== "seekingPhase" || seeker.manhuntTeam !== "seeker") {
      client.send("manhunt:feedback", { message: "Only seekers can tag during the seek phase." });
      return;
    }

    const nearest = this.findNearestActiveHider(seeker);
    if (!nearest) {
      client.send("manhunt:feedback", { message: "No active hider is close enough to tag." });
      return;
    }

    nearest.player.manhuntStatus = "tagged";
    seeker.manhuntPoints += 3;
    seeker.totalPoints += 3;
    this.state.manhunt.message = `${seeker.name} tagged ${nearest.player.name}!`;
    console.log(`[Manhunt] tag: ${this.playerLabel(client.sessionId)} tagged ${this.playerLabel(nearest.sessionId)} (+3 seeker points)`);

    if (this.areAllHidersResolved()) {
      this.finishManhuntRound("All hiders are safe or tagged!");
    }
  }

  private findNearestActiveHider(seeker: PlayerState): { sessionId: string; player: PlayerState; distance: number } | null {
    let closest: { sessionId: string; player: PlayerState; distance: number } | null = null;
    const seekerPosition = this.playerPosition(seeker);

    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.manhuntTeam !== "hider" || player.manhuntStatus !== "active") {
        continue;
      }

      const currentDistance = distance(seekerPosition, this.playerPosition(player));
      if (currentDistance <= MANHUNT_TAG_DISTANCE && (!closest || currentDistance < closest.distance)) {
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
      console.log(`[Manhunt] safe event: ${this.playerLabel(sessionId)} reached Home Base (+3 hider points)`);
    }
  }

  private finishManhuntRound(reason: string): void {
    if (this.state.manhunt.phase === "roundOver" || this.state.manhunt.phase === "lobby") {
      return;
    }

    for (const [, player] of this.state.players.entries()) {
      if (player.manhuntTeam === "hider" && player.manhuntStatus === "active") {
        player.manhuntPoints += 1;
        player.totalPoints += 1;
      }
    }

    this.setManhuntPhase("roundOver", MANHUNT_RESULTS_SECONDS, reason);
    this.teleportManhuntPlayers(this.getLobbySpawn());
    console.log(`[Manhunt] round over: ${reason}`);
  }

  private resetManhuntToLobby(): void {
    this.state.manhunt.phase = "lobby";
    this.state.manhunt.timerSeconds = 0;
    this.state.manhunt.message = "Go to Home Base and press M to start Manhunt.";
    this.state.manhunt.startedBy = "";

    for (const [, player] of this.state.players.entries()) {
      this.resetPlayerManhuntFields(player, true);
    }

    console.log("[Manhunt] phase changed -> lobby; players returned to free roam");
  }

  private resetPlayerManhuntFields(player: PlayerState, keepPoints: boolean): void {
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
      this.teleportPlayer(player, { x: position.x + offset, y: position.y, z: position.z });
      offset += 1.5;
    }
  }

  private teleportPlayer(player: PlayerState, position: Vec3): void {
    player.x = position.x;
    player.y = position.y;
    player.z = position.z;
  }

  private shouldLockPlayerAtSeekerStart(player: PlayerState): boolean {
    return player.manhuntTeam === "seeker" && this.state.manhunt.phase === "hidingPhase";
  }

  private lockSeekersAtStart(): void {
    const start = this.getSeekerStart();
    for (const [, player] of this.state.players.entries()) {
      if (player.manhuntTeam === "seeker") {
        this.teleportPlayer(player, start);
      }
    }
  }

  private isPlayerInSafeZone(player: PlayerState): boolean {
    return distanceXZ(this.playerPosition(player), this.getSafeZone()) <= this.state.manhunt.safeZoneRadius;
  }

  private logManhuntConfig(): void {
    const safeZone = this.getSafeZone();
    const hiderStart = this.getHiderStart();
    const seekerStart = this.getSeekerStart();
    const lobbySpawn = this.getLobbySpawn();

    console.log(
      `[Manhunt] Home Base configured at (${safeZone.x}, ${safeZone.y}, ${safeZone.z}), radius ${this.state.manhunt.safeZoneRadius}`,
    );
    console.log(`[Manhunt] HiderStart configured at (${hiderStart.x}, ${hiderStart.y}, ${hiderStart.z})`);
    console.log(`[Manhunt] SeekerStart configured at (${seekerStart.x}, ${seekerStart.y}, ${seekerStart.z})`);
    console.log(`[Manhunt] LobbySpawn configured at (${lobbySpawn.x}, ${lobbySpawn.y}, ${lobbySpawn.z})`);
  }

  private areAllHidersResolved(): boolean {
    const hiders = this.getHiders();
    return hiders.length > 0 && hiders.every((player) => player.manhuntStatus === "safe" || player.manhuntStatus === "tagged");
  }

  private getHiders(): PlayerState[] {
    return Array.from(this.state.players.values()).filter((player) => player.manhuntTeam === "hider");
  }

  private isRoundActive(): boolean {
    return ["countdown", "hidingPhase", "seekingPhase"].includes(this.state.manhunt.phase);
  }

  private playerPosition(player: PlayerState): Vec3 {
    return { x: player.x, y: player.y, z: player.z };
  }

  private getSafeZone(): Vec3 {
    return { x: this.state.manhunt.safeZoneX, y: this.state.manhunt.safeZoneY, z: this.state.manhunt.safeZoneZ };
  }

  private getHiderStart(): Vec3 {
    return { x: this.state.manhunt.hiderStartX, y: this.state.manhunt.hiderStartY, z: this.state.manhunt.hiderStartZ };
  }

  private getSeekerStart(): Vec3 {
    return { x: this.state.manhunt.seekerStartX, y: this.state.manhunt.seekerStartY, z: this.state.manhunt.seekerStartZ };
  }

  private getLobbySpawn(): Vec3 {
    return { x: this.state.manhunt.lobbySpawnX, y: this.state.manhunt.lobbySpawnY, z: this.state.manhunt.lobbySpawnZ };
  }

  private playerLabel(sessionId: string): string {
    const player = this.state.players.get(sessionId);
    return player ? `${player.name} (${sessionId.slice(0, 4)})` : sessionId.slice(0, 4);
  }
}
