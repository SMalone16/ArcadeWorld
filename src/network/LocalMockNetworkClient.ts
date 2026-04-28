import type { INetworkClient } from '../game/types';

export class LocalMockNetworkClient implements INetworkClient {
  private snapshotHandler: ((snapshot: unknown) => void) | null = null;

  public async connect(): Promise<void> {
    // Future Colyseus client setup would happen here.
    console.log('[Network:Mock] connect');
  }

  public async disconnect(): Promise<void> {
    console.log('[Network:Mock] disconnect');
  }

  public async joinLobby(lobbyId: string): Promise<void> {
    console.log(`[Network:Mock] joinLobby ${lobbyId}`);
  }

  public async leaveLobby(): Promise<void> {
    console.log('[Network:Mock] leaveLobby');
  }

  public sendInput(input: Record<string, unknown>): void {
    // In a real client this would be forwarded to the server room/session.
    console.log('[Network:Mock] sendInput', input);
  }

  public onSnapshot(handler: (snapshot: unknown) => void): void {
    this.snapshotHandler = handler;
  }

  public emitMockSnapshot(snapshot: unknown): void {
    this.snapshotHandler?.(snapshot);
  }
}
