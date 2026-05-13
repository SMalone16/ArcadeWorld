import { Application, Keyboard, KEY_E, KEY_M, Mouse } from 'playcanvas';
import { LobbyScene } from '../scenes/LobbyScene';
import { PlayerController } from '../entities/PlayerController';
import { Hud } from '../ui/Hud';
import { GAME_CONFIG } from './config';
import { createNetworkClient } from '../network/NetworkClient';
import type { Interactable } from '../entities/Interactable';
import { ManhuntRoundManager } from '../events/ManhuntRoundManager';

export class ArcadeGame {
  private static readonly TRANSFORM_SEND_HZ = 15;
  private static readonly POSITION_SEND_THRESHOLD = 0.02;
  private static readonly ROTATION_SEND_THRESHOLD_DEGREES = 1.5;

  private readonly app: Application;
  private readonly lobbyScene: LobbyScene;
  private playerController: PlayerController | null = null;
  private readonly hud: Hud;
  private readonly networkClient = createNetworkClient();
  private readonly manhuntRoundManager: ManhuntRoundManager;
  private readonly localClientId = 'local-client-1';
  private nearbyInteractable: Interactable | null = null;
  private sendAccumulator = 0;
  private lastSentPosition: { x: number; y: number; z: number } | null = null;
  private lastSentRotation: { x: number; y: number; z: number } | null = null;

  public constructor(private readonly canvas: HTMLCanvasElement, private readonly uiContainer: HTMLElement) {
    this.app = new Application(canvas, {
      keyboard: new Keyboard(window),
      mouse: new Mouse(canvas)
    });

    this.app.setCanvasFillMode('FILL_WINDOW');
    this.app.setCanvasResolution('AUTO');
    window.addEventListener('resize', () => this.app.resizeCanvas());

    this.lobbyScene = new LobbyScene({ app: this.app });
    this.lobbyScene.build();

    this.hud = new Hud(this.uiContainer);
    this.manhuntRoundManager = new ManhuntRoundManager({
      app: this.app,
      networkClient: this.networkClient,
      localClientId: this.localClientId,
      lobbySpawn: this.lobbyScene.getManhuntLobbySpawn(),
      hiderStart: this.lobbyScene.getManhuntHiderStart(),
      seekerStart: this.lobbyScene.getManhuntSeekerStart(),
      safeZoneCenter: this.lobbyScene.safeZoneCenter,
      safeZoneRadius: this.lobbyScene.safeZoneRadius
    });
  }

  public async start(): Promise<void> {
    await this.networkClient.connect();
    await this.networkClient.joinLobby('default-lobby', {
      app: this.app,
      localClientId: this.localClientId,
      playersRoot: this.lobbyScene.playersRoot,
      spawnTransforms: this.lobbyScene.getSpawnTransforms()
    });

    const localPlayer = this.networkClient.getPlayerEntity(this.localClientId);
    if (localPlayer) {
      this.playerController = new PlayerController(this.app, localPlayer);
    }

    this.canvas.addEventListener('mousedown', () => {
      this.app.mouse?.enablePointerLock();
    });

    this.app.on('update', (dt: number) => {
      this.playerController?.update(dt);
      this.sendAccumulator += dt;
      this.syncLocalPlayerStateAtFixedTick();
      this.manhuntRoundManager.update(dt);
      this.hud.manhuntHud.update(this.manhuntRoundManager.getSnapshot());
      this.updateInteractionState();

      const keyboard = this.app.keyboard;
      if (keyboard?.wasPressed(KEY_M)) {
        this.manhuntRoundManager.sendStartAttemptDebug();
        const snapshot = this.manhuntRoundManager.getSnapshot();
        if (snapshot.state === 'roundOver') {
          this.manhuntRoundManager.resetToLobby();
        } else {
          this.manhuntRoundManager.startRound();
        }
      }

      if (this.nearbyInteractable && keyboard?.wasPressed(KEY_E)) {
        this.nearbyInteractable.interact();
      }
    });

    this.app.start();
  }

  private syncLocalPlayerStateAtFixedTick(): void {
    const tickIntervalSeconds = 1 / ArcadeGame.TRANSFORM_SEND_HZ;
    if (this.sendAccumulator < tickIntervalSeconds) {
      return;
    }
    this.sendAccumulator -= tickIntervalSeconds;

    const localPlayer = this.networkClient.getPlayerEntity(this.localClientId);
    if (!localPlayer) {
      return;
    }

    const position = localPlayer.getPosition();
    const rotation = localPlayer.getEulerAngles();
    const nextPosition = { x: position.x, y: position.y, z: position.z };
    const nextRotation = { x: rotation.x, y: rotation.y, z: rotation.z };

    const positionChanged = !this.lastSentPosition || this.distanceBetween(nextPosition, this.lastSentPosition) >= ArcadeGame.POSITION_SEND_THRESHOLD;
    const rotationChanged = !this.lastSentRotation || this.distanceBetween(nextRotation, this.lastSentRotation) >= ArcadeGame.ROTATION_SEND_THRESHOLD_DEGREES;

    if (!positionChanged && !rotationChanged) {
      return;
    }

    this.networkClient.sendInput({
      position: nextPosition,
      rotation: nextRotation
    });
    this.lastSentPosition = nextPosition;
    this.lastSentRotation = nextRotation;
  }

  private distanceBetween(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.hypot(dx, dy, dz);
  }

  private updateInteractionState(): void {
    const localPlayer = this.networkClient.getPlayerEntity(this.localClientId);
    if (!localPlayer) {
      this.nearbyInteractable = null;
      this.hud.interactionPrompt.hide();
      return;
    }

    const playerPos = localPlayer.getPosition();
    let closest: Interactable | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const interactable of this.lobbyScene.interactables) {
      const distance = playerPos.distance(interactable.entity.getPosition());
      if (distance < GAME_CONFIG.player.interactionRange && distance < closestDistance) {
        closestDistance = distance;
        closest = interactable;
      }
    }

    this.nearbyInteractable = closest;

    if (closest) {
      this.hud.interactionPrompt.show(closest.label);
    } else {
      this.hud.interactionPrompt.hide();
    }
  }
}
