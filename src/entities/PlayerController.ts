import { Entity, Vec3 } from 'playcanvas';
import { GAME_CONFIG } from '../game/config';

export class PlayerController {
  private readonly player: Entity;
  private readonly camera: Entity;
  private readonly app: import('playcanvas').AppBase;
  private readonly moveDir = new Vec3();

  public constructor(app: import('playcanvas').AppBase, player: Entity, camera: Entity) {
    this.app = app;
    this.player = player;
    this.camera = camera;
  }

  public update(dt: number): void {
    this.moveDir.set(0, 0, 0);

    const keyboard = this.app.keyboard;
    if (!keyboard) {
      return;
    }

    if (keyboard.isPressed(87)) this.moveDir.z -= 1; // W
    if (keyboard.isPressed(83)) this.moveDir.z += 1; // S
    if (keyboard.isPressed(65)) this.moveDir.x -= 1; // A
    if (keyboard.isPressed(68)) this.moveDir.x += 1; // D

    if (this.moveDir.lengthSq() > 0) {
      this.moveDir.normalize().mulScalar(GAME_CONFIG.player.speed * dt);
      this.player.translate(this.moveDir);
    }

    const pos = this.player.getPosition();
    this.camera.setPosition(
      pos.x + GAME_CONFIG.camera.offsetX,
      pos.y + GAME_CONFIG.camera.offsetY,
      pos.z + GAME_CONFIG.camera.offsetZ
    );
    this.camera.lookAt(pos);
  }
}
