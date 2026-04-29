import { Color, Entity, StandardMaterial } from 'playcanvas';

export interface PlayerPrefabOptions {
  name?: string;
  color?: Color;
}

/**
 * Reusable factory for creating player entities.
 * Networking/gameplay systems can spawn/despawn these without scene-specific coupling.
 */
export function createPlayerPrefab(options: PlayerPrefabOptions = {}): Entity {
  const player = new Entity(options.name ?? 'player');
  player.addComponent('render', { type: 'box' });
  player.setLocalScale(3, 3, 3);

  if (options.color) {
    const material = new StandardMaterial();
    material.diffuse = options.color;
    material.update();

    const meshInstance = player.render?.meshInstances[0];
    if (meshInstance) {
      meshInstance.material = material;
    }
  }

  return player;
}
