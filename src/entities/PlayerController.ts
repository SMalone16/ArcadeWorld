import { Entity, KEY_A, KEY_D, KEY_S, KEY_SHIFT, KEY_SPACE, KEY_W, Vec3 } from 'playcanvas';
import { GAME_CONFIG } from '../game/config';

export class PlayerController {
  private readonly player: Entity;
  private readonly head: Entity;
  private readonly avatarVisual: Entity;
  private readonly app: import('playcanvas').AppBase;
  private readonly moveDir = new Vec3();
  private yaw = 0;
  private pitch = 0;
  private verticalVelocity = 0;
  private isGrounded = true;
  private jumpSquashTimer = 0;
  private landingSquashTimer = 0;
  private readonly maxPitch = 80;

  public walkSpeed = GAME_CONFIG.player.walkSpeed;
  public sprintSpeed = GAME_CONFIG.player.sprintSpeed;
  public jumpForce = GAME_CONFIG.player.jumpForce;
  public gravity = GAME_CONFIG.player.gravity;
  public airControl = GAME_CONFIG.player.airControl;

  public constructor(app: import('playcanvas').AppBase, player: Entity) {
    this.app = app;
    this.player = player;
    const headNode = this.player.findByName('Head');
    const avatarVisualNode = this.player.findByName('AvatarVisual');
    if (!(headNode instanceof Entity)) {
      throw new Error('Local player is missing required Head transform.');
    }
    if (!(avatarVisualNode instanceof Entity)) {
      throw new Error('Local player is missing required AvatarVisual transform.');
    }
    this.head = headNode;
    this.avatarVisual = avatarVisualNode;

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

    if (keyboard.wasPressed(KEY_SPACE) && this.isGrounded) {
      this.verticalVelocity = this.jumpForce;
      this.isGrounded = false;
      this.jumpSquashTimer = 0.16;
    }

    if (this.moveDir.lengthSq() > 0) {
      const speed = keyboard.isPressed(KEY_SHIFT) ? this.sprintSpeed : this.walkSpeed;
      const control = this.isGrounded ? 1 : this.airControl;
      this.moveDir.normalize().mulScalar(speed * control * dt);
      this.player.translateLocal(this.moveDir);
    }

    this.updateVerticalMovement(dt);
    this.updateSquashAndStretch(dt);

    this.player.setLocalEulerAngles(0, this.yaw, 0);
    this.head.setLocalEulerAngles(this.pitch, 0, 0);
  }

  private updateVerticalMovement(dt: number): void {
    const position = this.player.getPosition();
    this.verticalVelocity -= this.gravity * dt;
    position.y += this.verticalVelocity * dt;

    if (position.y <= GAME_CONFIG.player.groundY) {
      if (!this.isGrounded && this.verticalVelocity < -2) {
        this.landingSquashTimer = 0.18;
      }
      position.y = GAME_CONFIG.player.groundY;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    }

    this.player.setPosition(position);
  }

  private updateSquashAndStretch(dt: number): void {
    this.jumpSquashTimer = Math.max(0, this.jumpSquashTimer - dt);
    this.landingSquashTimer = Math.max(0, this.landingSquashTimer - dt);

    let scaleXz = 3;
    let scaleY = 3;

    if (this.jumpSquashTimer > 0) {
      const t = this.jumpSquashTimer / 0.16;
      scaleXz = 3 * (1 + 0.08 * t);
      scaleY = 3 * (1 - 0.12 * t);
    } else if (!this.isGrounded && this.verticalVelocity > 0) {
      scaleXz = 3 * 0.94;
      scaleY = 3 * 1.12;
    } else if (this.landingSquashTimer > 0) {
      const t = this.landingSquashTimer / 0.18;
      scaleXz = 3 * (1 + 0.12 * t);
      scaleY = 3 * (1 - 0.16 * t);
    }

    this.avatarVisual.setLocalScale(scaleXz, scaleY, scaleXz);
  }

  private onMouseMove(event: { dx: number; dy: number }): void {
    this.yaw -= event.dx * GAME_CONFIG.camera.lookSensitivity;
    this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch - event.dy * GAME_CONFIG.camera.lookSensitivity));
  }
}
