export const GAME_CONFIG = {
  camera: {
    fov: 55,
    lookSensitivity: 0.12
  },
  player: {
    walkSpeed: 7,
    sprintSpeed: 10,
    jumpForce: 8.5,
    gravity: 24,
    airControl: 0.45,
    interactionRange: 2.6,
    groundY: 1.6
  },
  lobby: {
    width: 28,
    depth: 20,
    wallHeight: 6
  },
  manhunt: {
    countdownSeconds: 5,
    hidingPhaseSeconds: 10,
    seekingPhaseSeconds: 90,
    resultsSeconds: 10,
    tagDistance: 2.2,
    safeZoneRadius: 2.6,
    points: {
      hiderSafe: 3,
      hiderSurvive: 1,
      seekerTag: 3,
      seekerFailedHider: 1
    },
    spawns: {
      lobby: { x: 0, y: 1.6, z: 4 },
      hiderStart: { x: -8, y: 1.6, z: 5 },
      seekerStart: { x: 8, y: 1.6, z: 5 },
      safeZone: { x: 0, y: 0.05, z: -7 }
    }
  }
} as const;
