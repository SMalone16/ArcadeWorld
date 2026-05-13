import { AppBase, Color, Entity, Vec3 } from 'playcanvas';
import { createPlayerPrefab } from '../entities/PlayerPrefab';
import { GAME_CONFIG } from '../game/config';
import type { INetworkClient, ManhuntNetworkState, ManhuntStartDebugPayload, NetworkJoinContext, NetworkPlayerState, SpawnTransform } from '../game/types';

interface MockClientState {
  id: string;
  color?: Color;
  position: Vec3;
  rotationEuler: Vec3;
  isOwner?: boolean;
}

interface ProxySnapshot {
  position: Vec3;
  rotationEuler: Vec3;
  timestampMs: number;
}

export class LocalMockNetworkClient implements INetworkClient {
  private static readonly INTERPOLATION_BACK_TIME_MS = 120;
  private static readonly MAX_PROXY_BUFFER_LENGTH = 30;
  private snapshotHandler: ((snapshot: unknown) => void) | null = null;
  private rootEntity: Entity | null = null;
  private clientPlayerMap = new Map<string, Entity>();
  private proxySnapshotBuffers = new Map<string, ProxySnapshot[]>();
  private updateHandler: ((dt: number) => void) | null = null;
  private boundApp: AppBase | null = null;
  private localClientId = '';
  private spawnJoinCounter = 0;
  private lastManhuntFeedbackMessage = '';

  public async connect(): Promise<void> {
    console.log('[Network:Mock] connect');
  }

  public async disconnect(): Promise<void> {
    this.despawnAllPlayers();
    console.log('[Network:Mock] disconnect');
  }

  public async joinLobby(lobbyId: string, context: NetworkJoinContext): Promise<void> {
    console.log(`[Network:Mock] joinLobby ${lobbyId}`);
    this.rootEntity = context.playersRoot;
    this.boundApp = context.app;
    this.localClientId = context.localClientId;

    const localSpawn = this.pickSpawnTransform(context.spawnTransforms);
    const remoteSpawn = this.pickSpawnTransform(context.spawnTransforms);

    const mockClients: MockClientState[] = [
      { id: context.localClientId, position: localSpawn.position.clone(), rotationEuler: localSpawn.rotationEuler.clone(), isOwner: true },
      { id: 'mock-client-2', color: new Color(0.8, 0.3, 0.3), position: remoteSpawn.position.clone(), rotationEuler: remoteSpawn.rotationEuler.clone() }
    ];

    mockClients.forEach((client) => this.spawnPlayerForClient(client.id, client.position, client.rotationEuler, client.color, client.isOwner === true));

    if (this.boundApp && !this.updateHandler) {
      this.updateHandler = () => this.interpolateRemotePlayers();
      this.boundApp.on('update', this.updateHandler);
    }
  }

  public async leaveLobby(): Promise<void> {
    if (this.boundApp && this.updateHandler) {
      this.boundApp.off('update', this.updateHandler);
      this.updateHandler = null;
    }

    this.despawnAllPlayers();
    this.proxySnapshotBuffers.clear();
    this.boundApp = null;
    console.log('[Network:Mock] leaveLobby');
  }

  public sendInput(input: Record<string, unknown>): void {
    const positionInput = input.position as { x: number; y: number; z: number } | undefined;
    const rotationInput = input.rotation as { x: number; y: number; z: number } | undefined;
    if (!positionInput || !rotationInput) {
      return;
    }

    // Simple playtest authority model: local movement is authoritative, then broadcast.
    // For mock mode we forward to remote proxies to exercise smoothing behavior.
    const simulatedRemote = this.clientPlayerMap.get('mock-client-2');
    if (simulatedRemote) {
      const remoteSnapshot: ProxySnapshot = {
        position: new Vec3(positionInput.x + 1.5, positionInput.y, positionInput.z + 0.5),
        rotationEuler: new Vec3(rotationInput.x, rotationInput.y + 15, rotationInput.z),
        timestampMs: performance.now()
      };
      this.pushProxySnapshot('mock-client-2', remoteSnapshot);
    }

    this.snapshotHandler?.({
      type: 'transform',
      clientId: this.localClientId,
      position: positionInput,
      rotation: rotationInput
    });
  }

  public sendManhuntStartDebug(payload: ManhuntStartDebugPayload): void {
    console.log('[ManhuntDebug] mock debug:manhuntStartAttempt', payload);
  }

  public onSnapshot(handler: (snapshot: unknown) => void): void {
    this.snapshotHandler = handler;
  }

  public getPlayerEntity(clientId: string): Entity | null {
    return this.clientPlayerMap.get(clientId) ?? null;
  }

  public getPlayerIds(): string[] {
    return Array.from(this.clientPlayerMap.keys());
  }

  public getLocalSessionId(): string {
    return this.localClientId;
  }

  public getManhuntState(): ManhuntNetworkState | null {
    const players: Record<string, NetworkPlayerState> = {};

    this.clientPlayerMap.forEach((entity, clientId) => {
      const position = entity.getPosition();
      const rotation = entity.getEulerAngles();
      players[clientId] = {
        id: clientId,
        name: clientId,
        x: position.x,
        y: position.y,
        z: position.z,
        rotY: rotation.y
      };
    });

    return {
      phase: 'mock',
      message: 'Local mock network: no server feedback yet.',
      safeZoneX: GAME_CONFIG.manhunt.spawns.safeZone.x,
      safeZoneY: GAME_CONFIG.manhunt.spawns.safeZone.y,
      safeZoneZ: GAME_CONFIG.manhunt.spawns.safeZone.z,
      safeZoneRadius: GAME_CONFIG.manhunt.safeZoneRadius,
      players
    };
  }

  public getServerKnownLocalPlayer(): NetworkPlayerState | null {
    const localSessionId = this.getLocalSessionId();
    return this.getManhuntState()?.players[localSessionId] ?? null;
  }

  public getLastManhuntFeedbackMessage(): string {
    return this.lastManhuntFeedbackMessage;
  }

  public removeClient(clientId: string): void {
    this.despawnPlayerForClient(clientId);
  }

  public emitMockSnapshot(snapshot: unknown): void {
    this.snapshotHandler?.(snapshot);
  }

  private spawnPlayerForClient(clientId: string, position: Vec3, rotationEuler: Vec3, color?: Color, isOwner = false): Entity | null {
    if (!this.rootEntity || this.clientPlayerMap.has(clientId)) {
      return null;
    }

    const entity = createPlayerPrefab({ name: `player-${clientId}`, color, isOwner });
    entity.setPosition(position.x, position.y, position.z);
    entity.setEulerAngles(rotationEuler.x, rotationEuler.y, rotationEuler.z);
    this.rootEntity.addChild(entity);
    this.clientPlayerMap.set(clientId, entity);
    if (!isOwner) {
      this.proxySnapshotBuffers.set(clientId, [{ position: position.clone(), rotationEuler: rotationEuler.clone(), timestampMs: performance.now() }]);
    }
    return entity;
  }

  private despawnPlayerForClient(clientId: string): void {
    const entity = this.clientPlayerMap.get(clientId);
    if (!entity) {
      return;
    }

    entity.destroy();
    this.clientPlayerMap.delete(clientId);
    this.proxySnapshotBuffers.delete(clientId);
  }

  private despawnAllPlayers(): void {
    for (const clientId of this.clientPlayerMap.keys()) {
      this.despawnPlayerForClient(clientId);
    }
  }

  private pickSpawnTransform(spawnTransforms: SpawnTransform[]): SpawnTransform {
    if (spawnTransforms.length === 0) {
      return { position: new Vec3(0, 1.6, 4), rotationEuler: new Vec3(0, 180, 0) };
    }

    const occupied = Array.from(this.clientPlayerMap.values()).map((entity) => entity.getPosition().clone());
    const freeTransforms = spawnTransforms.filter((spawn) => !occupied.some((pos) => pos.distance(spawn.position) < 0.75));

    if (freeTransforms.length > 0) {
      const randomIndex = Math.floor(Math.random() * freeTransforms.length);
      return freeTransforms[randomIndex];
    }

    if (occupied.length > 0) {
      const farthest = spawnTransforms.reduce((best, candidate) => {
        const nearestOccupiedDistance = occupied.reduce((nearest, occupiedPos) => {
          const distance = occupiedPos.distance(candidate.position);
          return Math.min(nearest, distance);
        }, Number.POSITIVE_INFINITY);

        if (!best || nearestOccupiedDistance > best.nearestOccupiedDistance) {
          return { spawn: candidate, nearestOccupiedDistance };
        }

        return best;
      }, null as { spawn: SpawnTransform; nearestOccupiedDistance: number } | null);

      if (farthest) {
        return farthest.spawn;
      }
    }

    const index = this.spawnJoinCounter % spawnTransforms.length;
    this.spawnJoinCounter += 1;
    return spawnTransforms[index];
  }

  private pushProxySnapshot(clientId: string, snapshot: ProxySnapshot): void {
    const buffer = this.proxySnapshotBuffers.get(clientId) ?? [];
    buffer.push(snapshot);

    if (buffer.length > LocalMockNetworkClient.MAX_PROXY_BUFFER_LENGTH) {
      buffer.splice(0, buffer.length - LocalMockNetworkClient.MAX_PROXY_BUFFER_LENGTH);
    }

    this.proxySnapshotBuffers.set(clientId, buffer);
  }

  private interpolateRemotePlayers(): void {
    const renderTimeMs = performance.now() - LocalMockNetworkClient.INTERPOLATION_BACK_TIME_MS;

    this.proxySnapshotBuffers.forEach((buffer, clientId) => {
      const proxy = this.clientPlayerMap.get(clientId);
      if (!proxy || buffer.length === 0) {
        return;
      }

      while (buffer.length >= 2 && buffer[1].timestampMs <= renderTimeMs) {
        buffer.shift();
      }

      if (buffer.length >= 2) {
        const from = buffer[0];
        const to = buffer[1];
        const intervalMs = Math.max(to.timestampMs - from.timestampMs, 0.0001);
        const t = Math.min(Math.max((renderTimeMs - from.timestampMs) / intervalMs, 0), 1);
        proxy.setPosition(from.position.clone().lerp(from.position, to.position, t));
        proxy.setEulerAngles(from.rotationEuler.clone().lerp(from.rotationEuler, to.rotationEuler, t));
      } else {
        proxy.setPosition(buffer[0].position);
        proxy.setEulerAngles(buffer[0].rotationEuler);
      }
    });
  }
}
