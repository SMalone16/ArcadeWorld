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
  player.setLocalScale(1, 1, 1);

  // Keep visuals on a child so playful squash/stretch never changes the gameplay transform.
  const avatarVisual = new Entity('AvatarVisual');
  avatarVisual.addComponent('render', { type: 'box' });
  avatarVisual.setLocalScale(3, 3, 3);
  player.addChild(avatarVisual);

  const head = new Entity('Head');
  head.setLocalPosition(0, 3.6, 0);
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

    const meshInstance = avatarVisual.render?.meshInstances[0];
    if (meshInstance) {
      meshInstance.material = material;
    }
  }

  if (options.isOwner !== true) {
    playerCamera.camera!.enabled = false;
  }

  return player;
}
