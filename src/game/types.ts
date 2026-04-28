import type { Entity } from 'playcanvas';

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

export interface INetworkClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  joinLobby(lobbyId: string): Promise<void>;
  leaveLobby(): Promise<void>;
  sendInput(input: Record<string, unknown>): void;
  onSnapshot(handler: (snapshot: unknown) => void): void;
}
