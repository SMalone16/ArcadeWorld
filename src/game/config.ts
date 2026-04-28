export const GAME_CONFIG = {
  camera: {
    offsetX: 12,
    offsetY: 14,
    offsetZ: 12,
    fov: 55
  },
  player: {
    speed: 6,
    interactionRange: 2.6
  },
  lobby: {
    width: 28,
    depth: 20,
    wallHeight: 6
  }
} as const;
