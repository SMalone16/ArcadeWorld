import { Entity, KEY_A, KEY_D, KEY_S, KEY_W, Vec3 } from 'playcanvas';
import { GAME_CONFIG } from '../game/config';

export class PlayerController {
  private readonly player: Entity;
  private readonly head: Entity;
  private readonly app: import('playcanvas').AppBase;
  private readonly moveDir = new Vec3();
  private yaw = 0;
  private pitch = 0;
  private readonly maxPitch = 80;

  public constructor(app: import('playcanvas').AppBase, player: Entity) {
    this.app = app;
    this.player = player;
    const headNode = this.player.findByName('Head');
    if (!(headNode instanceof Entity)) {
      throw new Error('Local player is missing required Head transform.');
    }
    this.head = headNode;

    this.app.mouse?.on('mousemove', this.onMouseMove, this);
  }

  public update(dt: number): void {
    this.moveDir.set(0, 0, 0);

    const keyboard = this.app.keyboard;
    if (!keyboard) {
      return;
    }

    if (keyboard.isPressed(KEY_W)) this.moveDir.z -= 1;
    if (keyboard.isPressed(KEY_S)) this.moveDir.z += 1;
    if (keyboard.isPressed(KEY_A)) this.moveDir.x -= 1;
    if (keyboard.isPressed(KEY_D)) this.moveDir.x += 1;

    if (this.moveDir.lengthSq() > 0) {
      this.moveDir.normalize().mulScalar(GAME_CONFIG.player.speed * dt);
      this.player.translateLocal(this.moveDir);
    }

    this.player.setLocalEulerAngles(0, this.yaw, 0);
    this.head.setLocalEulerAngles(this.pitch, 0, 0);
  }

  private onMouseMove(event: { dx: number; dy: number }): void {
    this.yaw -= event.dx * GAME_CONFIG.camera.lookSensitivity;
    this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch - event.dy * GAME_CONFIG.camera.lookSensitivity));
  }
}
