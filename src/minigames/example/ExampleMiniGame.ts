import type { Entity } from 'playcanvas';
import type { IMiniGame } from '../../game/types';

export class ExampleMiniGame implements IMiniGame {
  public readonly id = 'example-mini-game';
  public readonly name = 'Example Mini-Game';

  public launch(cabinetEntity: Entity): void {
    // Placeholder launch hook. In future this could route to a dedicated scene/module.
    // Keeping this simple for now makes it easy to replace with real mini-games later.
    console.log(`[MiniGame] Launching ${this.name} from cabinet: ${cabinetEntity.name}`);
  }
}
