import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import { GAME_CONFIG } from '../game/config';
import { ArcadeCabinet } from '../entities/ArcadeCabinet';
import type { Interactable } from '../entities/Interactable';
import { LOBBY_CABINET_LAYOUT } from './lobbyLayout';

interface LobbySceneContext {
  app: import('playcanvas').AppBase;
}

export class LobbyScene {
  public readonly root = new Entity('lobby-root');
  public readonly playersRoot = new Entity('players-root');
  public readonly interactables: Interactable[] = [];
  public readonly camera: Entity;
  public readonly defaultSpawnPoint = new Vec3(0, 0.9, 4);

  public constructor(private readonly context: LobbySceneContext) {
    this.camera = this.createCamera();
  }

  public build(): void {
    this.context.app.root.addChild(this.root);
    this.addLighting();
    this.addRoom();
    this.addCabinets();

    this.root.addChild(this.playersRoot);
    this.root.addChild(this.camera);
  }

  private addLighting(): void {
    const light = new Entity('main-light');
    light.addComponent('light', {
      type: 'directional',
      color: new Color(1, 0.96, 0.9),
      intensity: 1.3,
      castShadows: false
    });
    light.setEulerAngles(45, 35, 0);
    this.root.addChild(light);

    const ambient = this.context.app.scene.ambientLight;
    ambient.set(0.3, 0.32, 0.4);
  }

  private addRoom(): void {
    const floor = this.createBox('floor', new Vec3(0, -0.1, 0), new Vec3(GAME_CONFIG.lobby.width, 0.2, GAME_CONFIG.lobby.depth), new Color(0.14, 0.16, 0.2));
    const backWall = this.createBox('back-wall', new Vec3(0, GAME_CONFIG.lobby.wallHeight / 2, -GAME_CONFIG.lobby.depth / 2), new Vec3(GAME_CONFIG.lobby.width, GAME_CONFIG.lobby.wallHeight, 0.3), new Color(0.18, 0.2, 0.28));
    const leftWall = this.createBox('left-wall', new Vec3(-GAME_CONFIG.lobby.width / 2, GAME_CONFIG.lobby.wallHeight / 2, 0), new Vec3(0.3, GAME_CONFIG.lobby.wallHeight, GAME_CONFIG.lobby.depth), new Color(0.18, 0.2, 0.28));
    const rightWall = this.createBox('right-wall', new Vec3(GAME_CONFIG.lobby.width / 2, GAME_CONFIG.lobby.wallHeight / 2, 0), new Vec3(0.3, GAME_CONFIG.lobby.wallHeight, GAME_CONFIG.lobby.depth), new Color(0.18, 0.2, 0.28));

    this.root.addChild(floor);
    this.root.addChild(backWall);
    this.root.addChild(leftWall);
    this.root.addChild(rightWall);
  }

  private addCabinets(): void {
    LOBBY_CABINET_LAYOUT.forEach((entry) => {
      const cabinet = new ArcadeCabinet(entry.id, entry.miniGameId, entry.position);
      this.interactables.push(cabinet);
      this.root.addChild(cabinet.entity);
    });
  }

  private createCamera(): Entity {
    const camera = new Entity('camera');
    camera.addComponent('camera', {
      clearColor: new Color(0.08, 0.1, 0.14),
      fov: GAME_CONFIG.camera.fov
    });
    return camera;
  }

  private createBox(name: string, position: Vec3, scale: Vec3, color: Color): Entity {
    const entity = new Entity(name);
    entity.addComponent('render', { type: 'box' });
    entity.setPosition(position);
    entity.setLocalScale(scale);

    const material = new StandardMaterial();
    material.diffuse = color;
    material.update();

    const meshInstance = entity.render?.meshInstances[0];
    if (meshInstance) {
      meshInstance.material = material;
    }

    return entity;
  }
}
