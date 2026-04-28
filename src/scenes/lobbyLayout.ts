export interface CabinetSpawnPoint {
  id: string;
  miniGameId: string;
  position: [number, number, number];
}

/**
 * Lobby cabinet layout kept in a dedicated module so cabinet definitions stay data-driven.
 * This helps future multiplayer sync logic reason about spawn points without scene internals.
 */
export const LOBBY_CABINET_LAYOUT: CabinetSpawnPoint[] = [
  { id: 'cab-1', miniGameId: 'example-mini-game', position: [-8, 1.3, -6] },
  { id: 'cab-2', miniGameId: 'example-mini-game', position: [-4, 1.3, -6] },
  { id: 'cab-3', miniGameId: 'example-mini-game', position: [0, 1.3, -6] },
  { id: 'cab-4', miniGameId: 'example-mini-game', position: [4, 1.3, -6] },
  { id: 'cab-5', miniGameId: 'example-mini-game', position: [8, 1.3, -6] }
];
