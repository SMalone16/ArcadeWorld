import { Application, Keyboard, KEY_E, Mouse } from 'playcanvas';
import { LobbyScene } from '../scenes/LobbyScene';
import { PlayerController } from '../entities/PlayerController';
import { Hud } from '../ui/Hud';
import { GAME_CONFIG } from './config';
import { createNetworkClient } from '../network/NetworkClient';
import type { Interactable } from '../entities/Interactable';

export class ArcadeGame {
  private readonly app: Application;
  private readonly lobbyScene: LobbyScene;
  private playerController: PlayerController | null = null;
  private readonly hud: Hud;
  private readonly networkClient = createNetworkClient();
  private readonly localClientId = 'local-client-1';
  private nearbyInteractable: Interactable | null = null;

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
  }

  public async start(): Promise<void> {
    await this.networkClient.connect();
    await this.networkClient.joinLobby('default-lobby', {
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
      this.syncLocalPlayerState();
      this.updateInteractionState();

      const keyboard = this.app.keyboard;
      if (this.nearbyInteractable && keyboard?.wasPressed(KEY_E)) {
        this.nearbyInteractable.interact();
      }
    });

    this.app.start();
  }

  private syncLocalPlayerState(): void {
    const localPlayer = this.networkClient.getPlayerEntity(this.localClientId);
    if (!localPlayer) {
      return;
    }

    const position = localPlayer.getPosition();
    const rotation = localPlayer.getEulerAngles();

    this.networkClient.sendInput({
      position: { x: position.x, y: position.y, z: position.z },
      rotation: { x: rotation.x, y: rotation.y, z: rotation.z }
    });
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
