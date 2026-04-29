import { Color, Entity, Vec3 } from 'playcanvas';
import { createPlayerPrefab } from '../entities/PlayerPrefab';
import type { INetworkClient, NetworkJoinContext, SpawnTransform } from '../game/types';

interface MockClientState {
  id: string;
  color?: Color;
  position: Vec3;
  rotationEuler: Vec3;
  isOwner?: boolean;
}

export class LocalMockNetworkClient implements INetworkClient {
  private snapshotHandler: ((snapshot: unknown) => void) | null = null;
  private rootEntity: Entity | null = null;
  private clientPlayerMap = new Map<string, Entity>();
  private spawnJoinCounter = 0;

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

    const localSpawn = this.pickSpawnTransform(context.spawnTransforms);
    const remoteSpawn = this.pickSpawnTransform(context.spawnTransforms);

    const mockClients: MockClientState[] = [
      { id: context.localClientId, position: localSpawn.position.clone(), rotationEuler: localSpawn.rotationEuler.clone(), isOwner: true },
      { id: 'mock-client-2', color: new Color(0.8, 0.3, 0.3), position: remoteSpawn.position.clone(), rotationEuler: remoteSpawn.rotationEuler.clone() }
    ];

    mockClients.forEach((client) => this.spawnPlayerForClient(client.id, client.position, client.rotationEuler, client.color, client.isOwner === true));
  }

  public async leaveLobby(): Promise<void> {
    this.despawnAllPlayers();
    console.log('[Network:Mock] leaveLobby');
  }

  public sendInput(input: Record<string, unknown>): void {
    console.log('[Network:Mock] sendInput', input);
  }

  public onSnapshot(handler: (snapshot: unknown) => void): void {
    this.snapshotHandler = handler;
  }

  public getPlayerEntity(clientId: string): Entity | null {
    return this.clientPlayerMap.get(clientId) ?? null;
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
    return entity;
  }

  private despawnPlayerForClient(clientId: string): void {
    const entity = this.clientPlayerMap.get(clientId);
    if (!entity) {
      return;
    }

    entity.destroy();
    this.clientPlayerMap.delete(clientId);
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
}
