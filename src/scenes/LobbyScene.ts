import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import { GAME_CONFIG } from '../game/config';
import { ArcadeCabinet } from '../entities/ArcadeCabinet';
import type { Interactable } from '../entities/Interactable';
import type { SpawnTransform } from '../game/types';
import { LOBBY_CABINET_LAYOUT } from './lobbyLayout';

interface LobbySceneContext {
  app: import('playcanvas').AppBase;
}

export class LobbyScene {
  public readonly root = new Entity('lobby-root');
  public readonly playersRoot = new Entity('players-root');
  public readonly interactables: Interactable[] = [];
  private readonly spawnPointEntities: Entity[] = [];

  public constructor(private readonly context: LobbySceneContext) {
  }

  public build(): void {
    this.context.app.root.addChild(this.root);
    this.addLighting();
    this.addRoom();
    this.addCabinets();
    this.addSpawnPoints();

    this.root.addChild(this.playersRoot);
  }

  public getSpawnTransforms(): SpawnTransform[] {
    return this.spawnPointEntities.map((spawnPoint) => ({
      position: spawnPoint.getPosition().clone(),
      rotationEuler: spawnPoint.getEulerAngles().clone()
    }));
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

  private addSpawnPoints(): void {
    const spawnDefinitions = [
      { position: new Vec3(0, 1.6, 4), rotationEuler: new Vec3(0, 180, 0) },
      { position: new Vec3(-5, 1.6, 2), rotationEuler: new Vec3(0, 140, 0) },
      { position: new Vec3(5, 1.6, 2), rotationEuler: new Vec3(0, 220, 0) },
      { position: new Vec3(-3, 1.6, -3), rotationEuler: new Vec3(0, 45, 0) },
      { position: new Vec3(3, 1.6, -3), rotationEuler: new Vec3(0, -45, 0) }
    ];

    spawnDefinitions.forEach((spawn, index) => {
      const spawnPoint = new Entity(`spawn-point-${index + 1}`);
      spawnPoint.tags.add('SpawnPoint');
      spawnPoint.setPosition(spawn.position);
      spawnPoint.setEulerAngles(spawn.rotationEuler);
      this.spawnPointEntities.push(spawnPoint);
      this.root.addChild(spawnPoint);
    });
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
