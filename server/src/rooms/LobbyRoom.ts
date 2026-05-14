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

type ManhuntPhase = "lobby" | "teamReveal" | "spawnCountdown" | "activeRound" | "roundOver";
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
const ROUND_OVER_SECONDS = 10;
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


function formatVec3(position: Vec3): string {
  return `(${position.x}, ${position.y}, ${position.z})`;
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

    this.onMessage("debug:playerPositionCapture", (client, message: PlayerPositionCaptureMessage) => {
      this.logPlayerPositionCapture(client, message);
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

      if (this.canPlayerMove(player) && typeof rotY === "number" && Number.isFinite(rotY)) {
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
    const hiderStart = HIDER_STARTS[0];
    const seekerStart = SEEKER_START;
    const lobbySpawn = LOBBY_SPAWN;
    manhunt.hiderStartX = hiderStart.x;
    manhunt.hiderStartY = hiderStart.y;
    manhunt.hiderStartZ = hiderStart.z;
    manhunt.seekerStartX = seekerStart.x;
    manhunt.seekerStartY = seekerStart.y;
    manhunt.seekerStartZ = seekerStart.z;
    manhunt.lobbySpawnX = lobbySpawn.x;
    manhunt.lobbySpawnY = lobbySpawn.y;
    manhunt.lobbySpawnZ = lobbySpawn.z;

    this.logManhuntConfig();
  }

  private handleManhuntStartRequest(client: Client): void {
    const requester = this.state.players.get(client.sessionId);
    console.log(`[Manhunt] start request received from ${this.playerLabel(client.sessionId)}`);

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
    console.log(`[Manhunt] start request rejected for ${this.playerLabel(client.sessionId)}: ${reason}`);
    client.send("manhunt:feedback", { message: reason });
    this.state.manhunt.message = reason;
  }

  private startManhuntRound(startedBy: string, entries: [string, PlayerState][]): void {
    const sorted = entries.sort(([a], [b]) => a.localeCompare(b));
    const nextRoundNumber = this.state.manhunt.roundNumber + 1;
    const rotated = this.rotateEntries(sorted, this.state.manhunt.roundNumber);
    const seekerCount = Math.floor(sorted.length / 2);
    const seekerIds = new Set(rotated.slice(0, seekerCount).map(([sessionId]) => sessionId));

    this.state.manhunt.roundNumber = nextRoundNumber;
    this.state.manhunt.startedBy = startedBy;
    this.state.manhunt.phase = "teamReveal";
    this.state.manhunt.timerSeconds = TEAM_REVEAL_SECONDS;
    this.state.manhunt.message = "Teams assigned. Get ready for Manhunt.";

    for (const [sessionId, player] of sorted) {
      const team: ManhuntTeam = seekerIds.has(sessionId) ? "seeker" : "hider";
      player.manhuntTeam = team;
      player.manhuntStatus = "active";
      player.manhuntPoints = 0;
      player.isInManhuntRound = true;
      console.log(`[Manhunt] team assignment: ${this.playerLabel(sessionId)} -> ${team}`);
    }

    console.log(`[Manhunt] phase changed -> teamReveal (${TEAM_REVEAL_SECONDS}s), seekers=${Array.from(seekerIds).map((id) => this.playerLabel(id)).join(", ")}`);
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
      this.setManhuntPhase("spawnCountdown", ROUND_START_COUNTDOWN_SECONDS, "Round starts soon. Get ready!");
      return;
    }

    if (phase === "spawnCountdown") {
      this.setManhuntPhase("activeRound", ACTIVE_ROUND_SECONDS, "Manhunt is live!");
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

  private setManhuntPhase(phase: ManhuntPhase, seconds: number, message: string): void {
    this.state.manhunt.phase = phase;
    this.state.manhunt.timerSeconds = seconds;
    this.state.manhunt.message = message;
    console.log(`[Manhunt] phase changed -> ${phase} (${seconds}s): ${message}`);
  }

  private handleManhuntTagRequest(client: Client): void {
    const seeker = this.state.players.get(client.sessionId);
    if (!seeker || this.state.manhunt.phase !== "activeRound" || seeker.manhuntTeam !== "seeker" || seeker.manhuntStatus !== "active") {
      client.send("manhunt:feedback", { message: "Only seekers can tag during the active round." });
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

    this.setManhuntPhase("roundOver", ROUND_OVER_SECONDS, this.buildRoundOverMessage(reason));
    console.log(`[Manhunt] round over: ${reason}`);
  }

  private resetManhuntToLobby(): void {
    this.state.manhunt.phase = "lobby";
    this.state.manhunt.timerSeconds = 0;
    this.state.manhunt.message = "Go to Home Base and press M to start Manhunt.";
    this.state.manhunt.startedBy = "";

    this.teleportManhuntPlayers(this.getLobbySpawn());

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
    player.serverTeleportId += 1;
  }

  private canPlayerMove(player: PlayerState): boolean {
    const phase = this.state.manhunt.phase as ManhuntPhase;
    if (phase === "teamReveal" || phase === "spawnCountdown" || phase === "roundOver") {
      return false;
    }

    if (player.manhuntStatus === "tagged" || player.manhuntStatus === "safe") {
      return false;
    }

    return true;
  }

  private rotateEntries(entries: [string, PlayerState][], offset: number): [string, PlayerState][] {
    if (entries.length === 0) {
      return [];
    }

    const start = offset % entries.length;
    return entries.slice(start).concat(entries.slice(0, start));
  }

  private teleportPlayersToManhuntStarts(): void {
    let hiderIndex = 0;
    for (const [sessionId, player] of this.state.players.entries()) {
      if (!player.isInManhuntRound) {
        continue;
      }

      const spawn = player.manhuntTeam === "seeker" ? this.getSeekerStart() : this.getHiderStartAt(hiderIndex++);
      const spawnName = player.manhuntTeam === "seeker" ? "SeekerStart" : `HiderStart${((hiderIndex - 1) % HIDER_STARTS.length) + 1}`;
      this.teleportPlayer(player, spawn);
      console.log(`[ManhuntDebug] teleporting ${this.playerLabel(sessionId)} as ${player.manhuntTeam} to ${spawnName} ${formatVec3(spawn)}`);
    }
  }

  private buildRoundOverMessage(reason: string): string {
    const hiderScore = this.getTeamScore("hider");
    const seekerScore = this.getTeamScore("seeker");
    const winner = hiderScore > seekerScore ? "HIDERS WIN" : seekerScore > hiderScore ? "SEEKERS WIN" : "TIE ROUND";
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
    return distanceXZ(this.playerPosition(player), this.getSafeZone()) <= this.state.manhunt.safeZoneRadius;
  }

  private logManhuntConfig(): void {
    const safeZone = this.getSafeZone();
    const seekerStart = this.getSeekerStart();
    const lobbySpawn = this.getLobbySpawn();

    console.log(`[Manhunt] Home Base configured at ${formatVec3(safeZone)}, radius ${this.state.manhunt.safeZoneRadius}`);
    console.log(`[Manhunt] HiderStarts configured at ${HIDER_STARTS.map(formatVec3).join(", ")}`);
    console.log(`[Manhunt] SeekerStart configured at ${formatVec3(seekerStart)}`);
    console.log(`[Manhunt] LobbySpawn configured at ${formatVec3(lobbySpawn)}`);
  }

  private logPlayerPositionCapture(client: Client, message: PlayerPositionCaptureMessage): void {
    const position = message?.position;
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) {
      console.log(`[ManhuntDebug] Position capture from ${this.playerLabel(client.sessionId)} ignored: invalid payload`);
      return;
    }

    const label = sanitizeName(message.label, "standing at current position");
    const displayName = sanitizeName(message.localDisplayName, this.state.players.get(client.sessionId)?.name ?? "Player");
    console.log(
      `[ManhuntDebug] Position capture from ${displayName} (${client.sessionId.slice(0, 4)}): ` +
        `${position.x}, ${position.y}, ${position.z} label=${label}`,
    );
  }

  private areAllHidersResolved(): boolean {
    const hiders = this.getHiders();
    return hiders.length > 0 && hiders.every((player) => player.manhuntStatus === "safe" || player.manhuntStatus === "tagged");
  }

  private getHiders(): PlayerState[] {
    return Array.from(this.state.players.values()).filter((player) => player.manhuntTeam === "hider");
  }

  private isRoundActive(): boolean {
    return ["teamReveal", "spawnCountdown", "activeRound"].includes(this.state.manhunt.phase);
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

  private getHiderStartAt(index: number): Vec3 {
    return HIDER_STARTS[index % HIDER_STARTS.length];
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
