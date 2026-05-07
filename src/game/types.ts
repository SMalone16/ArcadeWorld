import type { AppBase, Entity, Vec3 } from 'playcanvas';

export interface SpawnTransform {
  position: Vec3;
  rotationEuler: Vec3;
}

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface IMiniGame {
  id: string;
  name: string;
  launch(cabinetEntity: Entity): void;
}

export interface NetworkJoinContext {
  app: AppBase;
  localClientId: string;
  playersRoot: Entity;
  spawnTransforms: SpawnTransform[];
}

export interface INetworkClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  joinLobby(lobbyId: string, context: NetworkJoinContext): Promise<void>;
  leaveLobby(): Promise<void>;
  sendInput(input: Record<string, unknown>): void;
  onSnapshot(handler: (snapshot: unknown) => void): void;
  getPlayerEntity(clientId: string): Entity | null;
  getPlayerIds(): string[];
}
