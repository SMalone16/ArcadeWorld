/* global pc */

var LocalPlayerController = pc.createScript("localPlayerController");

LocalPlayerController.attributes.add("networkManagerEntity", {
  type: "entity",
  title: "Network Manager Entity"
});

LocalPlayerController.attributes.add("moveSpeed", {
  type: "number",
  default: 4,
  title: "Move Speed"
});

LocalPlayerController.attributes.add("playerName", {
  type: "string",
  default: "",
  title: "Player Name"
});

/**
 * Basic WASD movement for today's multiplayer slice.
 * Keep collision handling simple; rely on map colliders when available.
 */
LocalPlayerController.prototype.initialize = function () {
  this.networkClient = null;
  this.lastSentPosition = new pc.Vec3();
  this.sendInterval = 0.05;
  this.sendTimer = 0;

  if (this.networkManagerEntity && this.networkManagerEntity.script) {
    this.networkClient = this.networkManagerEntity.script.arcadeNetworkClient;
  }

  if (!this.networkClient) {
    console.warn("[LocalPlayerController] ArcadeNetworkClient not found.");
  }

  var cfg = window.ArcadeConfig || {};
  this._playerName = this.playerName || (cfg.PLAYER_NAME_PREFIX || "Student");
};

LocalPlayerController.prototype.update = function (dt) {
  var moveX = 0;
  var moveZ = 0;

  if (this.app.keyboard.isPressed(pc.KEY_A)) moveX -= 1;
  if (this.app.keyboard.isPressed(pc.KEY_D)) moveX += 1;
  if (this.app.keyboard.isPressed(pc.KEY_W)) moveZ -= 1;
  if (this.app.keyboard.isPressed(pc.KEY_S)) moveZ += 1;

  if (moveX !== 0 || moveZ !== 0) {
    var direction = new pc.Vec3(moveX, 0, moveZ).normalize();
    var delta = direction.scale(this.moveSpeed * dt);

    this.entity.translate(delta);

    // Face movement direction in simple top-down style.
    var yawDegrees = Math.atan2(direction.x, direction.z) * pc.math.RAD_TO_DEG;
    this.entity.setEulerAngles(0, yawDegrees, 0);
  }

  this.sendTimer += dt;
  if (this.networkClient && this.sendTimer >= this.sendInterval) {
    this.sendTimer = 0;

    var pos = this.entity.getPosition();
    var rot = this.entity.getEulerAngles();

    // Send regularly for now to keep state simple and predictable.
    this.networkClient.sendMove(pos, rot.y, this._playerName);
    this.lastSentPosition.copy(pos);
  }
};
