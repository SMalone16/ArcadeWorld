import { Color, Entity, Vec3 } from 'playcanvas';
import { createPlayerPrefab } from '../entities/PlayerPrefab';
import type { INetworkClient, NetworkJoinContext } from '../game/types';

interface MockClientState {
  id: string;
  color?: Color;
  position: Vec3;
  isOwner?: boolean;
}

export class LocalMockNetworkClient implements INetworkClient {
  private snapshotHandler: ((snapshot: unknown) => void) | null = null;
  private rootEntity: Entity | null = null;
  private clientPlayerMap = new Map<string, Entity>();

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

    const mockClients: MockClientState[] = [
      { id: context.localClientId, position: context.spawnPoint.clone(), isOwner: true },
      { id: 'mock-client-2', color: new Color(0.8, 0.3, 0.3), position: context.spawnPoint.clone().add(new Vec3(2, 0, -2)) }
    ];

    mockClients.forEach((client) => this.spawnPlayerForClient(client.id, client.position, client.color, client.isOwner === true));
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

  private spawnPlayerForClient(clientId: string, position: Vec3, color?: Color, isOwner = false): Entity | null {
    if (!this.rootEntity || this.clientPlayerMap.has(clientId)) {
      return null;
    }

    const entity = createPlayerPrefab({ name: `player-${clientId}`, color, isOwner });
    entity.setPosition(position.x, position.y, position.z);
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
}
