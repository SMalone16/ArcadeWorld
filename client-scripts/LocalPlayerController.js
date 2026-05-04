/* global pc */

var LocalPlayerController = pc.createScript("localPlayerController");

LocalPlayerController.attributes.add("networkManagerEntity", {
  type: "entity",
  title: "Network Manager Entity"
});

LocalPlayerController.attributes.add("cameraEntity", {
  type: "entity",
  title: "Camera Entity"
});

LocalPlayerController.attributes.add("moveSpeed", {
  type: "number",
  default: 5,
  title: "Move Speed"
});

LocalPlayerController.attributes.add("mouseSensitivity", {
  type: "number",
  default: 0.15,
  title: "Mouse Sensitivity"
});

LocalPlayerController.attributes.add("eyeHeight", {
  type: "number",
  default: 1.5,
  title: "Eye Height"
});

LocalPlayerController.attributes.add("cameraBackOffset", {
  type: "number",
  default: 0,
  title: "Camera Back Offset"
});

LocalPlayerController.attributes.add("minPitch", {
  type: "number",
  default: -80,
  title: "Min Pitch"
});

LocalPlayerController.attributes.add("maxPitch", {
  type: "number",
  default: 80,
  title: "Max Pitch"
});

LocalPlayerController.attributes.add("playerName", {
  type: "string",
  default: "",
  title: "Player Name"
});

LocalPlayerController.attributes.add("enablePointerLock", {
  type: "boolean",
  default: true,
  title: "Enable Pointer Lock"
});

LocalPlayerController.attributes.add("sendInterval", {
  type: "number",
  default: 0.05,
  title: "Network Send Interval"
});

LocalPlayerController.prototype.initialize = function () {
  this.networkClient = null;
  this.sendTimer = 0;
  this.hasLoggedFirstMovement = false;

  this.yawDegrees = this.entity.getEulerAngles().y || 0;
  this.pitchDegrees = 0;

  this._move = new pc.Vec3();
  this._forward = new pc.Vec3();
  this._right = new pc.Vec3();
  this._cameraOffset = new pc.Vec3();
  this._cameraWorldPos = new pc.Vec3();

  this._onMouseMoveBound = this._onMouseMove.bind(this);
  this._onMouseDownBound = this._onMouseDown.bind(this);

  var cfg = window.ArcadeConfig || {};
  this._playerName = this.playerName || (cfg.PLAYER_NAME_PREFIX || "Student");

  this._resolveNetworkClient();
  this._resolveCameraEntity();

  this.entity.setEulerAngles(0, this.yawDegrees, 0);
  this._applyCameraTransform();

  if (this.app.mouse) {
    this.app.mouse.on(pc.EVENT_MOUSEMOVE, this._onMouseMoveBound, this);
    this.app.mouse.on(pc.EVENT_MOUSEDOWN, this._onMouseDownBound, this);
  }

  this.on("enable", this._onEnable, this);
  this.on("disable", this._onDisable, this);
  this.on("destroy", this._onDestroy, this);

  console.log("[LocalPlayerController] Initialized");
  console.log("[LocalPlayerController] Camera mode: first-person");
  this._onEnable();
};

LocalPlayerController.prototype._resolveNetworkClient = function () {
  if (!this.networkManagerEntity) {
    console.warn("[LocalPlayerController] networkManagerEntity is not configured. Local movement will still work.");
    return;
  }

  if (this.networkManagerEntity.script) {
    this.networkClient = this.networkManagerEntity.script.arcadeNetworkClient;
  }

  if (!this.networkClient) {
    console.warn("[LocalPlayerController] ArcadeNetworkClient not found. Local movement will still work.");
    return;
  }

  console.log("[LocalPlayerController] Network client assigned");
};

LocalPlayerController.prototype._resolveCameraEntity = function () {
  if (!this.cameraEntity) {
    this.cameraEntity = this.entity.findByName("Camera");
  }

  if (!this.cameraEntity) {
    this.cameraEntity = this.app.root.findByName("Camera");
  }

  if (!this.cameraEntity) {
    console.error("[LocalPlayerController] cameraEntity is missing. Assign it in editor or add a Camera entity.");
    return;
  }

  console.log("[LocalPlayerController] Camera assigned: " + this.cameraEntity.name);
};

LocalPlayerController.prototype._onEnable = function () {
  console.log("[LocalPlayerController] Input enabled");
};

LocalPlayerController.prototype._onDisable = function () {
  // Keep listeners active for re-enable lifecycle; disable only changes update behavior.
};

LocalPlayerController.prototype._onDestroy = function () {
  if (this.app.mouse) {
    this.app.mouse.off(pc.EVENT_MOUSEMOVE, this._onMouseMoveBound, this);
    this.app.mouse.off(pc.EVENT_MOUSEDOWN, this._onMouseDownBound, this);
  }
};

LocalPlayerController.prototype._onMouseDown = function () {
  if (!this.enablePointerLock || !this.app.mouse || pc.Mouse.isPointerLocked()) {
    return;
  }

  this.app.mouse.enablePointerLock();
  console.log("[LocalPlayerController] Pointer lock requested");
};

LocalPlayerController.prototype._onMouseMove = function (event) {
  if (!this.enabled) {
    return;
  }

  if (this.enablePointerLock && !pc.Mouse.isPointerLocked()) {
    return;
  }

  this.yawDegrees -= event.dx * this.mouseSensitivity;
  this.pitchDegrees -= event.dy * this.mouseSensitivity;
  this.pitchDegrees = pc.math.clamp(this.pitchDegrees, this.minPitch, this.maxPitch);
};

LocalPlayerController.prototype.update = function (dt) {
  var pointerLockedNow = this.app.mouse && pc.Mouse.isPointerLocked ? pc.Mouse.isPointerLocked() : false;
  if (pointerLockedNow !== this._pointerLockLastState) {
    this._pointerLockLastState = pointerLockedNow;
    console.log("[LocalPlayerController] Pointer " + (pointerLockedNow ? "locked" : "unlocked"));
  }

  this.entity.setEulerAngles(0, this.yawDegrees, 0);

  var horizontal = 0;
  var vertical = 0;

  if (this.app.keyboard.isPressed(pc.KEY_A)) horizontal -= 1;
  if (this.app.keyboard.isPressed(pc.KEY_D)) horizontal += 1;
  if (this.app.keyboard.isPressed(pc.KEY_W)) vertical += 1;
  if (this.app.keyboard.isPressed(pc.KEY_S)) vertical -= 1;

  this._move.set(0, 0, 0);

  if (horizontal !== 0 || vertical !== 0) {
    this._forward.copy(this.entity.forward);
    this._forward.y = 0;
    if (this._forward.lengthSq() > 0) this._forward.normalize();

    this._right.copy(this.entity.right);
    this._right.y = 0;
    if (this._right.lengthSq() > 0) this._right.normalize();

    this._move.add(this._forward.clone().scale(vertical));
    this._move.add(this._right.clone().scale(horizontal));

    if (this._move.lengthSq() > 1) {
      this._move.normalize();
    }

    this._move.scale(this.moveSpeed * dt);
    this.entity.translate(this._move);

    if (!this.hasLoggedFirstMovement) {
      this.hasLoggedFirstMovement = true;
      console.log("[LocalPlayerController] First movement detected");
      this._sendMoveState();
    }
  }

  this._applyCameraTransform();

  this.sendTimer += dt;
  if (this.sendTimer >= this.sendInterval) {
    this.sendTimer = 0;
    this._sendMoveState();
  }
};

LocalPlayerController.prototype._applyCameraTransform = function () {
  if (!this.cameraEntity) {
    return;
  }

  this._cameraOffset.set(0, this.eyeHeight, this.cameraBackOffset);

  var isChild = this.cameraEntity.parent === this.entity;
  if (isChild) {
    this.cameraEntity.setLocalPosition(this._cameraOffset);
    this.cameraEntity.setLocalEulerAngles(this.pitchDegrees, 0, 0);
    return;
  }

  this._cameraWorldPos.copy(this.entity.getPosition()).add(this._cameraOffset);
  this.cameraEntity.setPosition(this._cameraWorldPos);
  this.cameraEntity.setEulerAngles(this.pitchDegrees, this.yawDegrees, 0);
};

LocalPlayerController.prototype._sendMoveState = function () {
  if (!this.networkClient) {
    return;
  }

  var pos = this.entity.getPosition();
  this.networkClient.sendMove(pos, this.yawDegrees, this._playerName);
};
