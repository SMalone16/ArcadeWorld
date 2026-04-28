import { Color, Entity, StandardMaterial, Vec3 } from 'playcanvas';
import type { Interactable } from './Interactable';
import { getMiniGameById } from '../minigames/registry';

export class ArcadeCabinet implements Interactable {
  public readonly id: string;
  public readonly label: string;
  public readonly entity: Entity;
  private readonly miniGameId: string;

  public constructor(id: string, miniGameId: string, position: [number, number, number]) {
    this.id = id;
    this.miniGameId = miniGameId;
    this.label = `Press E to play ${miniGameId}`;

    this.entity = new Entity(`cabinet-${id}`);
    this.entity.addComponent('render', {
      type: 'box'
    });
    this.entity.addComponent('collision', {
      type: 'box',
      halfExtents: new Vec3(0.7, 1.3, 0.6)
    });

    this.entity.setPosition(position[0], position[1], position[2]);
    this.entity.setLocalScale(1.4, 2.6, 1.2);

    const material = new StandardMaterial();
    material.diffuse = new Color(0.2, 0.25, 0.4);
    material.update();

    const meshInstance = this.entity.render?.meshInstances[0];
    if (meshInstance) {
      meshInstance.material = material;
    }
  }

  public interact(): void {
    const miniGame = getMiniGameById(this.miniGameId);
    if (!miniGame) {
      console.warn(`[Cabinet] Mini-game '${this.miniGameId}' is not registered.`);
      return;
    }

    miniGame.launch(this.entity);
  }
}
