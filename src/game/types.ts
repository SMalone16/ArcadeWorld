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

export interface NetworkPlayerState {
  id: string;
  name?: string;
  x: number;
  y: number;
  z: number;
  rotY?: number;
}

export interface ManhuntNetworkState {
  phase?: string;
  message?: string;
  safeZoneX: number;
  safeZoneY: number;
  safeZoneZ: number;
  safeZoneRadius: number;
  players: Record<string, NetworkPlayerState>;
}

export interface ManhuntStartDebugPayload {
  localPlayer: Vector3Like | null;
  safeZoneEntity: Vector3Like;
  clientDistanceXZ: number | null;
  clientSafeZoneRadius: number;
  serverSafeZone: {
    x: number;
    y: number;
    z: number;
    radius: number;
  } | null;
  localSessionId: string;
  localDisplayName: string;
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
  sendManhuntStartDebug(payload: ManhuntStartDebugPayload): void;
  onSnapshot(handler: (snapshot: unknown) => void): void;
  getPlayerEntity(clientId: string): Entity | null;
  getPlayerIds(): string[];
  getLocalSessionId(): string;
  getManhuntState(): ManhuntNetworkState | null;
  getServerKnownLocalPlayer(): NetworkPlayerState | null;
  getLastManhuntFeedbackMessage(): string;
}
