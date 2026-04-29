import { Color, Entity, StandardMaterial } from 'playcanvas';

export interface PlayerPrefabOptions {
  name?: string;
  color?: Color;
  isOwner?: boolean;
}

/**
 * Reusable factory for creating player entities.
 * Networking/gameplay systems can spawn/despawn these without scene-specific coupling.
 */
export function createPlayerPrefab(options: PlayerPrefabOptions = {}): Entity {
  const player = new Entity(options.name ?? 'player');
  player.addComponent('render', { type: 'box' });
  player.setLocalScale(3, 3, 3);

  const head = new Entity('Head');
  head.setLocalPosition(0, 1.2, 0);
  player.addChild(head);

  const playerCamera = new Entity('PlayerCamera');
  playerCamera.addComponent('camera', {
    clearColor: new Color(0.08, 0.1, 0.14),
    fov: 55,
    enabled: options.isOwner === true
  });
  head.addChild(playerCamera);

  if (options.color) {
    const material = new StandardMaterial();
    material.diffuse = options.color;
    material.update();

    const meshInstance = player.render?.meshInstances[0];
    if (meshInstance) {
      meshInstance.material = material;
    }
  }

  if (options.isOwner !== true) {
    playerCamera.camera!.enabled = false;
  }

  return player;
}
