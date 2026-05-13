import { KEY_E, Vec3 } from 'playcanvas';
import { GAME_CONFIG } from '../game/config';
import type { INetworkClient, ManhuntStartDebugPayload, SpawnTransform, Vector3Like } from '../game/types';

export type ManhuntRoundState = 'lobby' | 'countdown' | 'hidingPhase' | 'seekingPhase' | 'roundOver';
export type ManhuntTeam = 'hider' | 'seeker';

export interface ManhuntPlayerState {
  playerId: string;
  team: ManhuntTeam;
  isTagged: boolean;
  isSafe: boolean;
  roundPoints: number;
}

export interface ManhuntDebugSnapshot {
  showDebugInfo: boolean;
  localPlayerPosition: Vector3Like | null;
  safeZonePosition: Vector3Like;
  clientDistanceXZ: number | null;
  clientSafeZoneRadius: number;
  serverHomeBase: { x: number; y: number; z: number; radius: number } | null;
  serverKnownLocalPlayer: Vector3Like | null;
  localVsServerDelta: Vector3Like | null;
  lastServerFeedbackMessage: string;
}

export interface ManhuntRoundSnapshot {
  state: ManhuntRoundState;
  localPlayer?: ManhuntPlayerState;
  timerSeconds: number;
  hidersSafe: number;
  hidersTagged: number;
  hiderTotal: number;
  results: ManhuntPlayerState[];
  message: string;
  debug: ManhuntDebugSnapshot;
}

interface ManhuntRoundManagerOptions {
  app: import('playcanvas').AppBase;
  networkClient: INetworkClient;
  localClientId: string;
  lobbySpawn: SpawnTransform;
  hiderStart: SpawnTransform;
  seekerStart: SpawnTransform;
  safeZoneCenter: Vec3;
  safeZoneRadius: number;
}

/**
 * Central, client-side vertical slice for the first Manhunt event.
 * It intentionally keeps round rules separate from scene construction and rendering.
 */
export class ManhuntRoundManager {
  private readonly players = new Map<string, ManhuntPlayerState>();
  private state: ManhuntRoundState = 'lobby';
  private stateTimeRemaining = 0;
  private roundElapsed = 0;
  private results: ManhuntPlayerState[] = [];
  private message = 'Press M to start Manhunt.';
  private hasAwardedEndOfRoundPoints = false;
  public showDebugInfo = true;

  public constructor(private readonly options: ManhuntRoundManagerOptions) {
  }

  public getSnapshot(): ManhuntRoundSnapshot {
    const localPlayer = this.players.get(this.options.localClientId);
    const hiders = this.getHiders();
    return {
      state: this.state,
      localPlayer: localPlayer ? { ...localPlayer } : undefined,
      timerSeconds: Math.max(0, Math.ceil(this.stateTimeRemaining)),
      hidersSafe: hiders.filter((player) => player.isSafe).length,
      hidersTagged: hiders.filter((player) => player.isTagged).length,
      hiderTotal: hiders.length,
      results: this.results.map((player) => ({ ...player })),
      message: this.message,
      debug: this.getDebugSnapshot()
    };
  }

  public sendStartAttemptDebug(): void {
    const payload = this.createStartAttemptDebugPayload();
    this.options.networkClient.sendManhuntStartDebug(payload);
  }

  public startRound(): void {
    if (this.state !== 'lobby' && this.state !== 'roundOver') {
      return;
    }

    const playerIds = this.options.networkClient.getPlayerIds();
    if (playerIds.length < 2) {
      this.message = 'Need at least 2 players to start Manhunt.';
      console.warn('[Manhunt] start blocked: need at least 2 players');
      return;
    }

    this.players.clear();
    this.results = [];
    this.hasAwardedEndOfRoundPoints = false;

    const seekerId = playerIds[0];
    playerIds.forEach((playerId) => {
      const team: ManhuntTeam = playerId === seekerId ? 'seeker' : 'hider';
      this.players.set(playerId, {
        playerId,
        team,
        isTagged: false,
        isSafe: false,
        roundPoints: 0
      });
      console.log(`[Manhunt] team assignment: ${playerId} -> ${team}`);
    });

    this.teleportTeamsToStarts();
    this.setState('countdown', GAME_CONFIG.manhunt.countdownSeconds, 'Manhunt starts soon! Hiders, stay out of sight and sneak back to Home Base.');
  }

  public update(dt: number): void {
    if (this.state === 'lobby') {
      return;
    }

    this.stateTimeRemaining = Math.max(0, this.stateTimeRemaining - dt);
    if (this.state === 'seekingPhase') {
      this.roundElapsed += dt;
      this.checkSafeZoneEntries();
      this.checkTagInput();
      this.endRoundIfComplete();
    }

    if (this.stateTimeRemaining <= 0) {
      this.advanceStateFromTimer();
    }
  }

  public resetToLobby(): void {
    this.teleportAll(this.options.lobbySpawn);
    this.players.clear();
    this.results = [];
    this.hasAwardedEndOfRoundPoints = false;
    this.setState('lobby', 0, 'Press M to start Manhunt.');
  }


  private getDebugSnapshot(): ManhuntDebugSnapshot {
    const localPosition = this.getLocalPlayerPosition();
    const safeZonePosition = this.vectorToPlain(this.options.safeZoneCenter);
    const serverState = this.options.networkClient.getManhuntState();
    const serverKnownPlayer = this.options.networkClient.getServerKnownLocalPlayer();
    const serverKnownPosition = serverKnownPlayer ? { x: serverKnownPlayer.x, y: serverKnownPlayer.y, z: serverKnownPlayer.z } : null;
    const localVsServerDelta = localPosition && serverKnownPosition
      ? {
          x: localPosition.x - serverKnownPosition.x,
          y: localPosition.y - serverKnownPosition.y,
          z: localPosition.z - serverKnownPosition.z
        }
      : null;

    return {
      showDebugInfo: this.showDebugInfo,
      localPlayerPosition: localPosition,
      safeZonePosition,
      clientDistanceXZ: localPosition ? this.distanceXZ(localPosition, safeZonePosition) : null,
      clientSafeZoneRadius: this.options.safeZoneRadius,
      serverHomeBase: serverState
        ? {
            x: serverState.safeZoneX,
            y: serverState.safeZoneY,
            z: serverState.safeZoneZ,
            radius: serverState.safeZoneRadius
          }
        : null,
      serverKnownLocalPlayer: serverKnownPosition,
      localVsServerDelta,
      lastServerFeedbackMessage: this.options.networkClient.getLastManhuntFeedbackMessage()
    };
  }

  private createStartAttemptDebugPayload(): ManhuntStartDebugPayload {
    const debug = this.getDebugSnapshot();
    const localSessionId = this.options.networkClient.getLocalSessionId();
    const serverKnownPlayer = this.options.networkClient.getServerKnownLocalPlayer();

    return {
      localPlayer: debug.localPlayerPosition,
      safeZoneEntity: debug.safeZonePosition,
      clientDistanceXZ: debug.clientDistanceXZ,
      clientSafeZoneRadius: debug.clientSafeZoneRadius,
      serverSafeZone: debug.serverHomeBase,
      localSessionId,
      localDisplayName: serverKnownPlayer?.name ?? localSessionId
    };
  }

  private getLocalPlayerPosition(): Vector3Like | null {
    const localPlayer = this.options.networkClient.getPlayerEntity(this.options.localClientId);
    return localPlayer ? this.vectorToPlain(localPlayer.getPosition()) : null;
  }

  private vectorToPlain(vector: Vec3): Vector3Like {
    return { x: vector.x, y: vector.y, z: vector.z };
  }

  private distanceXZ(a: Vector3Like, b: Vector3Like): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  private advanceStateFromTimer(): void {
    if (this.state === 'countdown') {
      this.setState('hidingPhase', GAME_CONFIG.manhunt.hidingPhaseSeconds, 'Hiders: Stay out of sight. Sneak back to Home Base.');
      this.releaseHidersOnly();
      return;
    }

    if (this.state === 'hidingPhase') {
      this.roundElapsed = 0;
      this.setState('seekingPhase', GAME_CONFIG.manhunt.seekingPhaseSeconds, 'Seekers released! Protect Home Base. Watch for hiders and tag them with E.');
      this.releaseSeekers();
      return;
    }

    if (this.state === 'seekingPhase') {
      this.finishRound('Time is up!');
    }
  }

  private setState(nextState: ManhuntRoundState, durationSeconds: number, message: string): void {
    this.state = nextState;
    this.stateTimeRemaining = durationSeconds;
    this.message = message;
    console.log(`[Manhunt] state changed -> ${nextState} (${durationSeconds}s): ${message}`);
  }

  private teleportTeamsToStarts(): void {
    this.players.forEach((player) => {
      const spawn = player.team === 'seeker' ? this.options.seekerStart : this.options.hiderStart;
      this.teleportPlayer(player.playerId, spawn);
    });
  }

  private releaseHidersOnly(): void {
    this.getSeekers().forEach((seeker) => this.teleportPlayer(seeker.playerId, this.options.seekerStart));
  }

  private releaseSeekers(): void {
    this.getSeekers().forEach((seeker) => this.teleportPlayer(seeker.playerId, this.options.seekerStart));
  }

  private teleportAll(spawn: SpawnTransform): void {
    this.options.networkClient.getPlayerIds().forEach((playerId, index) => {
      const offsetSpawn = {
        position: spawn.position.clone().add(new Vec3(index * 1.5, 0, 0)),
        rotationEuler: spawn.rotationEuler
      };
      this.teleportPlayer(playerId, offsetSpawn);
    });
  }

  private teleportPlayer(playerId: string, spawn: SpawnTransform): void {
    const entity = this.options.networkClient.getPlayerEntity(playerId);
    if (!entity) {
      return;
    }

    entity.setPosition(spawn.position);
    entity.setEulerAngles(spawn.rotationEuler);
  }

  private checkSafeZoneEntries(): void {
    this.getHiders().forEach((hider) => {
      if (hider.isTagged || hider.isSafe) {
        return;
      }

      const entity = this.options.networkClient.getPlayerEntity(hider.playerId);
      if (!entity) {
        return;
      }

      const distance = entity.getPosition().distance(this.options.safeZoneCenter);
      if (distance > this.options.safeZoneRadius) {
        return;
      }

      hider.isSafe = true;
      hider.roundPoints += GAME_CONFIG.manhunt.points.hiderSafe;
      console.log(`[Manhunt] safe zone entry: ${hider.playerId} +${GAME_CONFIG.manhunt.points.hiderSafe}`);
      console.log(`[Manhunt] scoring: ${hider.playerId} now has ${hider.roundPoints}`);
    });
  }

  private checkTagInput(): void {
    const keyboard = this.options.app.keyboard;
    if (!keyboard?.wasPressed(KEY_E)) {
      return;
    }

    const localState = this.players.get(this.options.localClientId);
    if (!localState || localState.team !== 'seeker') {
      return;
    }

    const seekerEntity = this.options.networkClient.getPlayerEntity(localState.playerId);
    if (!seekerEntity) {
      return;
    }

    const seekerPosition = seekerEntity.getPosition();
    const tagTarget = this.getHiders()
      .filter((hider) => !hider.isTagged && !hider.isSafe)
      .map((hider) => ({ hider, entity: this.options.networkClient.getPlayerEntity(hider.playerId) }))
      .filter((entry): entry is { hider: ManhuntPlayerState; entity: import('playcanvas').Entity } => entry.entity !== null)
      .map((entry) => ({ ...entry, distance: seekerPosition.distance(entry.entity.getPosition()) }))
      .filter((entry) => entry.distance <= GAME_CONFIG.manhunt.tagDistance)
      .sort((a, b) => a.distance - b.distance)[0];

    if (!tagTarget) {
      return;
    }

    tagTarget.hider.isTagged = true;
    localState.roundPoints += GAME_CONFIG.manhunt.points.seekerTag;
    console.log(`[Manhunt] tag: ${localState.playerId} tagged ${tagTarget.hider.playerId}`);
    console.log(`[Manhunt] scoring: ${localState.playerId} +${GAME_CONFIG.manhunt.points.seekerTag} = ${localState.roundPoints}`);
  }

  private endRoundIfComplete(): void {
    const activeHiders = this.getHiders().filter((hider) => !hider.isTagged && !hider.isSafe);
    if (activeHiders.length === 0) {
      this.finishRound('All hiders are safe or tagged!');
    }
  }

  private finishRound(reason: string): void {
    if (this.state === 'roundOver') {
      return;
    }

    if (!this.hasAwardedEndOfRoundPoints) {
      this.awardEndOfRoundPoints();
    }

    this.results = Array.from(this.players.values()).map((player) => ({ ...player }));
    this.teleportAll(this.options.lobbySpawn);
    this.setState('roundOver', GAME_CONFIG.manhunt.resultsSeconds, `${reason} Results shown below.`);
  }

  private awardEndOfRoundPoints(): void {
    const failedHiderCount = this.getHiders().filter((hider) => !hider.isSafe).length;

    this.getHiders().forEach((hider) => {
      if (!hider.isTagged && !hider.isSafe) {
        hider.roundPoints += GAME_CONFIG.manhunt.points.hiderSurvive;
        console.log(`[Manhunt] scoring: ${hider.playerId} survived +${GAME_CONFIG.manhunt.points.hiderSurvive}`);
      }
    });

    this.getSeekers().forEach((seeker) => {
      const points = failedHiderCount * GAME_CONFIG.manhunt.points.seekerFailedHider;
      seeker.roundPoints += points;
      console.log(`[Manhunt] scoring: ${seeker.playerId} failed hiders ${failedHiderCount} +${points}`);
    });

    this.hasAwardedEndOfRoundPoints = true;
  }

  private getHiders(): ManhuntPlayerState[] {
    return Array.from(this.players.values()).filter((player) => player.team === 'hider');
  }

  private getSeekers(): ManhuntPlayerState[] {
    return Array.from(this.players.values()).filter((player) => player.team === 'seeker');
  }
}
